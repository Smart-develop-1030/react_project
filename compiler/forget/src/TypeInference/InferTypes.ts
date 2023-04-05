/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as t from "@babel/types";
import invariant from "invariant";
import { Environment } from "../HIR";
import {
  HIRFunction,
  Instruction,
  makeType,
  Type,
  typeEquals,
  TypeId,
  TypeVar,
} from "../HIR/HIR";
import { BuiltInArrayId, BuiltInObjectId } from "../HIR/ObjectShape";
import { eachInstructionLValue, eachInstructionOperand } from "../HIR/visitors";
import { assertExhaustive } from "../Utils/utils";

function isPrimitiveBinaryOp(op: t.BinaryExpression["operator"]): boolean {
  switch (op) {
    case "+":
    case "-":
    case "/":
    case "%":
    case "*":
    case "**":
    case "&":
    case "|":
    case ">>":
    case "<<":
    case "^":
    case ">":
    case "<":
    case ">=":
    case "<=":
    case "|>":
      return true;
    default:
      return false;
  }
}

export default function (func: HIRFunction): void {
  const unifier = new Unifier(func.env);
  for (const e of generate(func)) {
    unifier.unify(e.left, e.right);
  }
  apply(func, unifier);
}

function apply(func: HIRFunction, unifier: Unifier): void {
  for (const [_, block] of func.body.blocks) {
    for (const phi of block.phis) {
      phi.type = unifier.get(phi.type);
    }
    for (const instr of block.instructions) {
      for (const operand of eachInstructionLValue(instr)) {
        operand.identifier.type = unifier.get(operand.identifier.type);
      }
      for (const place of eachInstructionOperand(instr)) {
        place.identifier.type = unifier.get(place.identifier.type);
      }
      const { lvalue } = instr;
      lvalue.identifier.type = unifier.get(lvalue.identifier.type);
    }
  }
}

type TypeEquation = {
  left: Type;
  right: Type;
};

function equation(left: Type, right: Type): TypeEquation {
  return {
    left,
    right,
  };
}

function* generate(
  func: HIRFunction
): Generator<TypeEquation, void, undefined> {
  for (const [_, block] of func.body.blocks) {
    for (const phi of block.phis) {
      yield equation(phi.type, {
        kind: "Phi",
        operands: [...phi.operands.values()].map((id) => id.type),
      });
    }

    for (const instr of block.instructions) {
      yield* generateInstructionTypes(func.env, instr);
    }
  }
}

function* generateInstructionTypes(
  env: Environment,
  instr: Instruction
): Generator<TypeEquation, void, undefined> {
  const { lvalue, value } = instr;
  const left = lvalue.identifier.type;

  switch (value.kind) {
    case "JSXText":
    case "Primitive": {
      yield equation(left, { kind: "Primitive" });
      break;
    }

    case "UnaryExpression": {
      yield equation(left, { kind: "Primitive" });
      break;
    }

    case "LoadLocal": {
      yield equation(left, value.place.identifier.type);
      break;
    }

    case "StoreLocal": {
      yield equation(left, value.value.identifier.type);
      yield equation(
        value.lvalue.place.identifier.type,
        value.value.identifier.type
      );
      break;
    }

    case "BinaryExpression": {
      if (isPrimitiveBinaryOp(value.operator)) {
        yield equation(value.left.identifier.type, { kind: "Primitive" });
        yield equation(value.right.identifier.type, { kind: "Primitive" });
      }
      yield equation(left, { kind: "Primitive" });
      break;
    }

    case "LoadGlobal": {
      const globalType = env.getGlobalDeclaration(value.name);
      if (globalType) {
        yield equation(left, globalType);
      }
      break;
    }

    case "CallExpression": {
      // TODO: callee could be a hook or a function, so this type equation isn't correct.
      // We should change Hook to a subtype of Function or change unifier logic.
      // (see https://github.com/facebook/react-forget/pull/1427)
      yield equation(value.callee.identifier.type, {
        kind: "Function",
        shapeId: null,
        return: left,
      });
      break;
    }

    case "ObjectExpression": {
      yield equation(left, { kind: "Object", shapeId: BuiltInObjectId });
      break;
    }

    case "ArrayExpression": {
      yield equation(left, { kind: "Object", shapeId: BuiltInArrayId });
      break;
    }

    case "PropertyLoad": {
      yield equation(left, {
        kind: "Property",
        object: value.object.identifier.type,
        propertyName: value.property,
      });
      break;
    }

    case "MethodCall": {
      const returnType = makeType();
      yield equation(value.property.identifier.type, {
        kind: "Function",
        return: returnType,
        shapeId: null,
      });

      yield equation(left, returnType);
      break;
    }

    case "DeclareLocal":
    case "Destructure":
    case "NewExpression":
    case "TypeCastExpression":
    case "JsxExpression":
    case "JsxFragment":
    case "RegExpLiteral":
    case "PropertyStore":
    case "PropertyDelete":
    case "ComputedStore":
    case "ComputedLoad":
    case "ComputedDelete":
    case "FunctionExpression":
    case "TaggedTemplateExpression":
    case "TemplateLiteral":
    case "Await":
    case "NextIterableOf":
    case "UnsupportedNode":
      break;
    default:
      assertExhaustive(value, `Unhandled instruction value kind: ${value}`);
  }
}

type Substitution = Map<TypeId, Type>;
class Unifier {
  substitutions: Substitution = new Map();
  env: Environment;

  constructor(env: Environment) {
    this.env = env;
  }

  unify(tA: Type, tB: Type): void {
    if (tB.kind === "Property") {
      const objectType = this.get(tB.object);
      if (objectType.kind === "Object" || objectType.kind === "Function") {
        const propertyType = this.env.getPropertyType(
          objectType,
          tB.propertyName
        );
        if (propertyType !== null) {
          this.unify(tA, propertyType);
        }
      }
      // We do not error if tB is not a known object or function (even if it
      // is a primitive), since JS implicit conversion to objects
      return;
    }

    if (typeEquals(tA, tB)) {
      return;
    }

    if (tA.kind === "Type") {
      this.bindVariableTo(tA, tB);
      return;
    }

    if (tB.kind === "Type") {
      this.bindVariableTo(tB, tA);
      return;
    }

    if (tB.kind === "Function" && tA.kind === "Function") {
      this.unify(tA.return, tB.return);
      return;
    }
  }

  bindVariableTo(v: TypeVar, type: Type): void {
    if (type.kind === "Poly") {
      //  Ignore PolyType, since we don't support polymorphic types correctly.
      return;
    }

    if (this.substitutions.has(v.id)) {
      this.unify(this.substitutions.get(v.id)!, type);
      return;
    }

    if (type.kind === "Type" && this.substitutions.has(type.id)) {
      this.unify(v, this.substitutions.get(type.id)!);
      return;
    }

    if (type.kind === "Phi") {
      const operands = new Set(type.operands.map((i) => this.get(i).kind));

      invariant(operands.size > 0, "there should be at least one operand");
      const kind = operands.values().next().value;

      // there's only one unique type and it's not a type var
      if (operands.size === 1 && kind !== "Type") {
        this.unify(v, type.operands[0]);
        return;
      }
    }

    if (this.occursCheck(v, type)) {
      throw new Error("cycle detected");
    }

    this.substitutions.set(v.id, type);
  }

  occursCheck(v: TypeVar, type: Type): boolean {
    if (typeEquals(v, type)) return true;

    if (type.kind === "Type" && this.substitutions.has(type.id)) {
      return this.occursCheck(v, this.substitutions.get(type.id)!);
    }

    if (type.kind === "Phi") {
      return type.operands.some((o) => this.occursCheck(v, o));
    }

    if (type.kind === "Function") {
      return this.occursCheck(v, type.return);
    }

    return false;
  }

  get(type: Type): Type {
    if (type.kind === "Type") {
      if (this.substitutions.has(type.id)) {
        return this.get(this.substitutions.get(type.id)!);
      }
    }

    if (type.kind === "Phi") {
      return { kind: "Phi", operands: type.operands.map((o) => this.get(o)) };
    }

    return type;
  }
}
