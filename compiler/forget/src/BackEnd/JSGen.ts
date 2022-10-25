/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NodePath } from "@babel/traverse";
import type { Function } from "@babel/types";
import * as t from "@babel/types";
import { assertExhaustive } from "../Common/utils";
import type { CompilerContext } from "../CompilerContext";
import { invariant } from "../CompilerError";
import * as IR from "../IR";
import * as LIR from "../LIR";
import { isReactiveBlock, isRenderBlock } from "../LIR";
import { PassKind, PassName } from "../Pass";
import * as JS from "./JS";

/**
 * JavaScript Code Generation.
 */
export default {
  name: PassName.JSGen,
  kind: PassKind.LIRProg as const,
  run,
  mutatesBabelAST: true,
};

export function run(lirProg: LIR.Prog, context: CompilerContext) {
  if (lirProg.funcs.size === 0) {
    return;
  }

  const prog = lirProg.ir.ast;
  const utils = ["$empty"];
  if (context.opts.flags.guardHooks) {
    utils.push("$startLazy", "$endLazy");
  }
  if (context.opts.flags.guardReads) {
    utils.push("$read");
  }
  if (context.opts.flags.addFreeze) {
    utils.push("$makeReadOnly");
  }
  if (utils.length > 0) {
    prog.unshiftContainer(
      "body",
      t.variableDeclaration("const", [
        t.variableDeclarator(
          t.objectPattern(
            utils.map((util) =>
              t.objectProperty(
                t.identifier(util),
                t.identifier(util),
                false,
                true,
                null
              )
            )
          ),
          t.identifier("$ForgetRuntime")
        ),
      ])
    );
    prog.unshiftContainer(
      "body",
      t.importDeclaration(
        [
          t.importSpecifier(
            t.identifier("useMemoCache"),
            t.identifier("unstable_useMemoCache")
          ),
          t.importSpecifier(
            t.identifier("$ForgetRuntime"),
            t.identifier("unstable_ForgetRuntime")
          ),
        ],
        t.stringLiteral("react")
      )
    );
  }

  for (const [irFunc, lirFunc] of lirProg.funcs) {
    runFunc(lirFunc, irFunc.ast, context);
  }
}

export function runFunc(
  lirFunc: LIR.Func,
  func: NodePath<Function>,
  context: CompilerContext
) {
  const irFunc = lirFunc.ir;
  const jsFunc = new JS.Func(lirFunc, context);

  genPrologue();

  for (const block of lirFunc.blocks) {
    switch (block.kind) {
      case LIR.BlockKind.Render:
        invariant(isRenderBlock(block), "");
        genRenderBlock(block);
        break;
      case LIR.BlockKind.Reactive:
        invariant(isReactiveBlock(block), "");
        genReactiveBlock(block);
        break;
      default:
        assertExhaustive(block.kind, `Unhandled block ${block}`);
    }
  }

  if (irFunc.isImplicitReturn && !lirFunc.hasSingleReturnPath) {
    jsFunc.emit(jsFunc.genUpdateReturnIdx(irFunc.returnCount));
  }

  /**
   * Prologue ::
   *   useMemoCache()
   *   Reactive(Params)
   */
  function genPrologue(): void {
    for (const param of irFunc.params) {
      // params are immut
      jsFunc.emitMakeReadOnly(param);
      if (IR.isReactiveVal(param)) {
        jsFunc.emitReactiveVal(param);
      }
    }
  }

  /**
   * RenderBlock ::
   *   | Instr
   *   | Instr
   *     Reactive(Inputs)
   */
  function genRenderBlock(block: LIR.RenderBlock): void {
    for (const instr of block.body) {
      jsFunc.emit(instr.ast.node);

      for (const decl of instr.ir.decls) {
        if (decl.immutable) {
          jsFunc.emitMakeReadOnly(decl);
        }
        if (IR.isReactiveVal(decl)) {
          jsFunc.emitReactiveVal(decl);
        }
      }
    }
  }

  /**
   * @see {@link JS.Func.emitReactiveBlock}
   */
  function genReactiveBlock(block: LIR.ReactiveBlock): void {
    jsFunc.emitReactiveBlock(block);
  }

  /**
   * Replacing body with generated code.
   */
  const funcBody = func.get("body");

  // See {@link ReactFuncsInfer} for the reason.
  if (!funcBody.isBlockStatement()) throw new Error("Unreachable.");
  const directives = funcBody.node.directives;

  let code = jsFunc.code;
  code.unshift(jsFunc.useMemoCacheCall(lirFunc.memoCache.size));
  funcBody.replaceWithMultiple(code);

  // recover directives.
  funcBody.node.directives = directives;
}
