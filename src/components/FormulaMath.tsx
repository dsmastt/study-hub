import { useMemo } from "react";
import katex from "katex";
import clsx from "clsx";

export function FormulaMath({
  expression,
  block = true,
  className,
}: {
  expression: string;
  block?: boolean;
  className?: string;
}) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(expression, {
        throwOnError: false,
        displayMode: block,
        strict: "ignore",
        trust: false,
        output: "html",
      });
    } catch {
      return null;
    }
  }, [expression, block]);

  if (!html) {
    return <code className={clsx("formula-fallback", className)}>{expression}</code>;
  }
  return (
    <div
      className={clsx("formula-math", block && "formula-math-block", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
