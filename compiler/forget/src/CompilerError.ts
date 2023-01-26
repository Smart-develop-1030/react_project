import { Node, NodePath } from "@babel/traverse";
import { SourceLocation } from "@babel/types";
import { ExtractClassProperties } from "./Utils/types";
import { assertExhaustive } from "./Utils/utils";

export enum ErrorSeverity {
  InvalidInput = "InvalidInput",
  Todo = "Todo",
}

export type CompilerErrorOptions = {
  reason: string;
  severity: ErrorSeverity;
  nodePath: AnyNodePath;
};
type AnyNodePath = NodePath<Node | null | undefined>;
type CompilerErrorKind = typeof InvalidInputError | typeof TodoError;
type CompilerErrorDetailOptions = ExtractClassProperties<CompilerErrorDetail>;

function mapSeverityToErrorCtor(severity: ErrorSeverity): CompilerErrorKind {
  switch (severity) {
    case ErrorSeverity.InvalidInput:
      return InvalidInputError;
    case ErrorSeverity.Todo:
      return TodoError;
    default:
      assertExhaustive(severity, `Unhandled severity level: ${severity}`);
  }
}
class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = `${ErrorSeverity.InvalidInput}Error`;
  }
}
class TodoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = `${ErrorSeverity.Todo}Error`;
  }
}

export function tryPrintCodeFrame(
  options: CompilerErrorOptions
): string | null {
  if (options.nodePath == null) return null;
  try {
    return options.nodePath
      .buildCodeFrameError(
        options.reason,
        mapSeverityToErrorCtor(options.severity)
      )
      .toString();
  } catch {
    return null;
  }
}

/**
 * Each bailout or invariant in HIR lowering creates an {@link CompilerErrorDetail}, which is then
 * aggregated into a single {@link CompilerError} later.
 */
export class CompilerErrorDetail {
  reason: string;
  severity: ErrorSeverity;
  codeframe: string | null;
  loc: SourceLocation | null;

  constructor(options: CompilerErrorDetailOptions) {
    this.reason = options.reason;
    this.severity = options.severity;
    this.codeframe = options.codeframe;
    this.loc = options.loc;
  }

  printErrorMessage(): string {
    if (this.codeframe != null) {
      return this.codeframe;
    }
    const buffer = [`${this.severity}: ${this.reason}`];
    if (this.loc != null) {
      buffer.push(` (${this.loc.start.line}:${this.loc.end.line})`);
    }
    return buffer.join("");
  }

  toString(): string {
    return `[ReactForget] ${this.printErrorMessage()}`;
  }
}

export class CompilerError extends Error {
  details: CompilerErrorDetail[] = [];

  constructor(details: CompilerErrorDetail[], ...args: any[]) {
    super(...args);
    this.details = details;
    this.message = this.toString();
  }

  override toString() {
    return this.details.map((detail) => detail.toString()).join("\n\n");
  }
}
