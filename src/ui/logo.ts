import chalk from 'chalk';

const lines = [
  '██╗   ██╗███████╗██╗   ██╗   ████████╗██╗   ██╗██╗',
  '██║   ██║██╔════╝╚██╗ ██╔╝   ╚══██╔══╝██║   ██║██║',
  '██║   ██║█████╗   ╚████╔╝       ██║   ██║   ██║██║',
  '╚██╗ ██╔╝██╔══╝    ╚██╔╝        ██║   ██║   ██║██║',
  ' ╚████╔╝ ███████╗   ██║         ██║   ╚██████╔╝██║',
  '  ╚═══╝  ╚══════╝   ╚═╝         ╚═╝    ╚═════╝ ╚═╝',
];

const palette = [
  '#ff5f6d',
  '#ff7a59',
  '#ffb347',
  '#7ed957',
  '#38bdf8',
  '#8b5cf6',
];

export const renderLogo = (): string =>
  lines
    .map((line, rowIndex) =>
      [...line]
        .map((char, charIndex) => {
          if (char === ' ') {
            return char;
          }
          const color = palette[(rowIndex + charIndex) % palette.length];
          return chalk.hex(color)(char);
        })
        .join(''),
    )
    .join('\n');
