/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { transformFromAstSync } from "@babel/core";
import type { SourceLocation as BabelSourceLocation } from "@babel/types";
import ReactForgetBabelPlugin, {
  ErrorSeverity,
  type CompilerError,
  type CompilerErrorDetail,
  type PluginOptions,
} from "babel-plugin-react-forget";
import type { Rule } from "eslint";
import * as HermesParser from "hermes-parser";

type CompilerErrorDetailWithLoc = Omit<CompilerErrorDetail, "loc"> & {
  loc: BabelSourceLocation;
};

function isReactForgetCompilerError(err: Error): err is CompilerError {
  return err.name === "ReactForgetCompilerError";
}

function isReportableDiagnostic(
  detail: CompilerErrorDetail
): detail is CompilerErrorDetailWithLoc {
  let isCorrectSeverity = false;
  switch (detail.severity) {
    case ErrorSeverity.InvalidInput:
      isCorrectSeverity = true;
      break;
    case ErrorSeverity.Invariant:
    case ErrorSeverity.Todo:
      break;
  }

  return (
    isCorrectSeverity === true &&
    detail.loc != null &&
    typeof detail.loc !== "symbol"
  );
}

const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "Surfaces diagnostics from React Forget",
      recommended: true,
    },
  },
  create(context: Rule.RuleContext) {
    // Compat with older versions of eslint
    const sourceCode = context.sourceCode?.text ?? context.getSourceCode().text;
    const filename = context.filename ?? context.getFilename();

    const opts: Partial<PluginOptions> = {
      noEmit: true,
      enableOnlyOnUseForgetDirective: true,
      panicOnBailout: false,
      environment: {
        validateHooksUsage: true,
        validateFrozenLambdas: false,
        validateRefAccessDuringRender: true,
      },
    };
    const babelAST = HermesParser.parse(sourceCode, {
      babel: true,
      sourceFilename: filename,
      sourceType: "module",
    });
    if (babelAST != null) {
      try {
        transformFromAstSync(babelAST, sourceCode, {
          filename,
          highlightCode: false,
          retainLines: true,
          plugins: [
            [ReactForgetBabelPlugin, opts],
            "babel-plugin-fbt",
            "babel-plugin-fbt-runtime",
          ],
          sourceType: "module",
        });
      } catch (err) {
        if (isReactForgetCompilerError(err) && Array.isArray(err.details)) {
          for (const detail of err.details) {
            if (isReportableDiagnostic(detail)) {
              context.report({
                message: detail.toString(),
                loc: detail.loc,
              });
            }
          }
        } else {
          throw err;
        }
      }
    }
    return {};
  },
};

export default rule;
