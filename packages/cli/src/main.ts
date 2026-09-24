import { parseArgs } from 'node:util';
import { TARGETS } from '@tk-designer/codegen';

const USAGE = `Usage: tkd generate <file.tkui.json> --target <${TARGETS.join('|')}>`;

function main(argv: readonly string[]): number {
  const { positionals } = parseArgs({ args: [...argv], allowPositionals: true, strict: false });
  const [command] = positionals;

  if (command !== 'generate') {
    console.error(USAGE);
    return 1;
  }
  console.error('generate: 未実装');
  return 1;
}

process.exitCode = main(process.argv.slice(2));
