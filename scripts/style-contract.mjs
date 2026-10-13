import { readFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import postcss from 'postcss';
import { transform } from 'esbuild';

export function authoringStyles(root) {
  const files = [];
  const visit = (file, chain = []) => {
    if (chain.includes(file)) throw new Error(`CSS import cycle: ${[...chain, file].join(' -> ')}`);
    if (!file.startsWith(resolve(root, 'dist/styles') + '/')) throw new Error('CSS import outside source root');
    files.push(relative(root, file));
    const ast = postcss.parse(readFileSync(file, 'utf8'));
    ast.walkAtRules('import', rule => {
      const url = rule.params.match(/^(?:url\()?['"](.+?)['"]\)?$/)?.[1];
      if (!url || !url.startsWith('./')) throw new Error(`Unsupported CSS import: ${rule.params}`);
      rule.replaceWith(visit(resolve(dirname(file), url), [...chain, file]).nodes);
    });
    return ast;
  };
  return { css: visit(resolve(root, 'dist/styles/index.css')).toString(), files };
}

export function rootTokens(css) {
  const values = new Map();
  postcss.parse(css).walkRules(':root', rule => {
    if (rule.parent.type !== 'root') return;
    rule.walkDecls(/^--/, declaration => values.set(declaration.prop, declaration.value));
  });
  return values;
}

export function resolveTokens(value, values, stack = []) {
  return value.replace(/var\(\s*(--[\w-]+)\s*\)/g, (match, name) => {
    if (!values.has(name)) return match;
    if (stack.includes(name)) throw new Error(`Token cycle: ${name}`);
    return resolveTokens(values.get(name), values, [...stack, name]);
  });
}

// Exact scalar/cascade regression evidence, not a substitute for pixels.
// Leave responsive overrides and scoped properties in place; remove only
// unconditional root declarations after resolving the same root environment.
export async function expandedCascade(css) {
  const values = rootTokens(css);
  const ast = postcss.parse(css);
  const overridden = new Set();
  ast.walkDecls(/^--/, d => {
    if (d.parent.selector !== ':root' || d.parent.parent.type !== 'root') overridden.add(d.prop);
  });
  // A root default that changes under a media condition must remain a var():
  // expanding it once would conceal a broken responsive binding.
  for (const name of overridden) values.delete(name);
  ast.walkDecls(d => {
    if (d.prop.startsWith('--') && !overridden.has(d.prop) && d.parent.selector === ':root' && d.parent.parent.type === 'root') d.remove();
    else d.value = resolveTokens(d.value, values).replace(/\bwhite\b/g, '#ffffff').replace(/\bblack\b/g, '#000000')
      .replace(/#([\da-f])([\da-f])([\da-f])\b/gi, (_, r, g, b) => `#${r}${r}${g}${g}${b}${b}`);
  });
  ast.walkComments(c => c.remove());
  return (await transform(ast.toString(), { loader: 'css', minify: true, legalComments: 'none' })).code;
}
