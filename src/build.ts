import { readFile } from 'node:fs/promises';

import Component from './Component';

const render = async (filePath: string) => {
  const entryPoint = new Component(filePath);

  entryPoint.parse();
};

await render('../examples/site/src/pages/index.tmph.html');