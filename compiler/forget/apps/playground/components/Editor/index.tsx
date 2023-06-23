/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { parse, ParserPlugin } from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import {
  Effect,
  Hook,
  printHIR,
  printReactiveFunction,
  run,
  ValueKind,
} from "babel-plugin-react-forget";
import clsx from "clsx";
import invariant from "invariant";
import { useSnackbar } from "notistack";
import { useDeferredValue, useMemo } from "react";
import { useMountEffect } from "../../hooks";
import { defaultStore } from "../../lib/defaultStore";
import {
  createMessage,
  initStoreFromUrlOrLocalStorage,
  MessageLevel,
  MessageSource,
  type Store,
} from "../../lib/stores";
import { useStore, useStoreDispatch } from "../StoreContext";
import Input from "./Input";
import {
  CompilerOutput,
  default as Output,
  PrintedCompilerPipelineValue,
} from "./Output";

function parseFunctions(
  source: string
): Array<NodePath<t.FunctionDeclaration>> {
  const items: Array<NodePath<t.FunctionDeclaration>> = [];
  try {
    const isFlow = source
      .trim()
      .split("\n", 1)[0]
      .match(/\s*\/\/\s*\@flow\s*/);
    let type_transform: ParserPlugin;
    if (isFlow) {
      type_transform = "flow";
    } else {
      type_transform = "typescript";
    }
    const ast = parse(source, {
      plugins: [type_transform, "jsx"],
      sourceType: "module",
    });
    traverse(ast, {
      FunctionDeclaration: {
        enter(nodePath) {
          items.push(nodePath);
          nodePath.skip();
        },
      },
    });
  } catch (e) {
    console.error(e);
  }
  return items;
}

const COMMON_HOOKS: Array<[string, Hook]> = [
  [
    "useFragment",
    {
      valueKind: ValueKind.Frozen,
      effectKind: Effect.Freeze,
    },
  ],
  [
    "usePaginationFragment",
    {
      valueKind: ValueKind.Frozen,
      effectKind: Effect.Freeze,
    },
  ],
  [
    "useRefetchableFragment",
    {
      valueKind: ValueKind.Frozen,
      effectKind: Effect.Freeze,
    },
  ],
  [
    "useLazyLoadQuery",
    {
      valueKind: ValueKind.Frozen,
      effectKind: Effect.Freeze,
    },
  ],
  [
    "usePreloadedQuery",
    {
      valueKind: ValueKind.Frozen,
      effectKind: Effect.Freeze,
    },
  ],
];

function parsePragma(pragma: string) {
  let memoizeJsxElements = true;
  let enableAssumeHooksFollowRulesOfReact = false;
  let enableTreatHooksAsFunctions = true;
  let disableAllMemoization = false;
  let validateRefAccessDuringRender = true;
  let enableEmitFreeze = null;
  let enableOptimizeFunctionExpressions = false;
  let inlineUseMemo = true;
  let validateHooksUsage = true;
  let enableFunctionCallSignatureOptimizations = true;
  let validateFrozenLambdas = true;
  let assertValidMutableRanges = true;

  if (pragma.includes("@memoizeJsxElements false")) {
    memoizeJsxElements = false;
  }
  if (pragma.includes("@enableAssumeHooksFollowRulesOfReact true")) {
    enableAssumeHooksFollowRulesOfReact = true;
  }
  if (pragma.includes("@enableTreatHooksAsFunctions false")) {
    enableTreatHooksAsFunctions = false;
  }
  if (pragma.includes("@disableAllMemoization true")) {
    disableAllMemoization = true;
  }
  if (pragma.includes("@validateRefAccessDuringRender false")) {
    validateRefAccessDuringRender = false;
  }
  if (pragma.includes("@enableOptimizeFunctionExpressions")) {
    enableOptimizeFunctionExpressions = true;
  }
  if (pragma.includes("@enableEmitFreeze")) {
    enableEmitFreeze = {
      source: "react-forget-runtime",
      importSpecifierName: "makeReadOnly",
    };
  }
  if (pragma.includes("@inlineUseMemo false")) {
    inlineUseMemo = false;
  }
  if (pragma.includes("@enableFunctionCallSignatureOptimizations false")) {
    enableFunctionCallSignatureOptimizations = false;
  }
  if (pragma.includes("@validateHooksUsage false")) {
    validateHooksUsage = false;
  }
  if (pragma.includes("@validateFrozenLambdas false")) {
    validateHooksUsage = false;
  }
  if (pragma.includes("@assertValidMutableRanges false")) {
    assertValidMutableRanges = false;
  }

  return {
    enableAssumeHooksFollowRulesOfReact,
    enableFunctionCallSignatureOptimizations,
    disableAllMemoization,
    enableTreatHooksAsFunctions,
    inlineUseMemo,
    memoizeJsxElements,
    validateHooksUsage,
    validateRefAccessDuringRender,
    validateFrozenLambdas,
    enableEmitFreeze,
    enableOptimizeFunctionExpressions,
    assertValidMutableRanges,
  };
}

function compile(source: string): CompilerOutput {
  const results = new Map<string, PrintedCompilerPipelineValue[]>();
  const upsert = (result: PrintedCompilerPipelineValue) => {
    const entry = results.get(result.name);
    if (Array.isArray(entry)) {
      entry.push(result);
    } else {
      results.set(result.name, [result]);
    }
  };
  try {
    // Extract the first line to quickly check for custom test directives
    const pragma = source.substring(0, source.indexOf("\n"));
    const options = parsePragma(pragma);

    for (const fn of parseFunctions(source)) {
      for (const result of run(fn, {
        customHooks: new Map([...COMMON_HOOKS]),
        ...options,
      })) {
        const fnName = fn.node.id?.name ?? null;
        switch (result.kind) {
          case "ast": {
            upsert({
              kind: "ast",
              fnName,
              name: result.name,
              value: result.value,
            });
            break;
          }
          case "hir": {
            upsert({
              kind: "hir",
              fnName,
              name: result.name,
              value: printHIR(result.value.body),
            });
            break;
          }
          case "reactive": {
            upsert({
              kind: "reactive",
              fnName,
              name: result.name,
              value: printReactiveFunction(result.value),
            });
            break;
          }
          case "debug": {
            upsert({
              kind: "debug",
              fnName,
              name: result.name,
              value: result.value,
            });
            break;
          }
          default: {
            const _: never = result;
            throw new Error(`Unhandled result ${result}`);
          }
        }
      }
    }
    return { kind: "ok", results };
  } catch (error: any) {
    console.error(error);
    // error might be an invariant violation or other runtime error
    // (i.e. object shape that is not CompilerError)
    if (error.details == null) {
      error.details = [];
    }
    return { kind: "err", results, error };
  }
}

export default function Editor() {
  const store = useStore();
  const deferredStore = useDeferredValue(store);
  const dispatchStore = useStoreDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const compilerOutput = useMemo(
    () => compile(deferredStore.source),
    [deferredStore.source]
  );

  useMountEffect(() => {
    let mountStore: Store;
    try {
      mountStore = initStoreFromUrlOrLocalStorage();
    } catch (e) {
      invariant(e instanceof Error, "Only Error may be caught.");
      enqueueSnackbar(e.message, {
        variant: "message",
        ...createMessage(
          "Bad URL - fell back to the default Playground.",
          MessageLevel.Info,
          MessageSource.Playground
        ),
      });
      mountStore = defaultStore;
    }
    dispatchStore({
      type: "setStore",
      payload: { store: mountStore },
    });
  });

  return (
    <>
      <div className="relative flex basis top-14">
        <div
          style={{ minWidth: 650 }}
          className={clsx("relative sm:basis-1/4")}
        >
          <Input
            errors={
              compilerOutput.kind === "err" ? compilerOutput.error.details : []
            }
          />
        </div>
        <div className={clsx("flex sm:flex flex-wrap")}>
          <Output store={deferredStore} compilerOutput={compilerOutput} />
        </div>
      </div>
    </>
  );
}
