const palettes = {
  toy: {
    wall: '#E8BB93', floor: '#F1EDE1', ceiling: '#F7E5D4', box: '#F0A844',
    robot: '#EEE8D8', robotFace: '#F8F3E8', joint: '#D6A850', eye: '#74D9DF',
    switch: '#F07F5A', background: '#C7ECF5', gravity: '#25BEB5', goal: '#FFD66E',
    obstacle: '#C9D9DF', door: '#688A9C', grid: '#D8C79E', ambient: '#FFF7E8', groundLight: '#9D7458',
  },
  mint: {
    wall: '#BFE2D3', floor: '#E9F3EC', ceiling: '#D8EFE8', box: '#FF796C',
    robot: '#F7FAF7', robotFace: '#FFFFFF', joint: '#47777B', eye: '#31D3D0',
    switch: '#F3B65A', background: '#CDEFF2', gravity: '#00AAA5', goal: '#FFE27A',
    obstacle: '#8BBEB4', door: '#4F7E83', grid: '#B7D4C8', ambient: '#F4FFFB', groundLight: '#699489',
  },
  candy: {
    wall: '#D8C8EE', floor: '#F4EFF9', ceiling: '#E8DCF5', box: '#FFD35A',
    robot: '#F4C5DA', robotFace: '#FFF4F8', joint: '#A36FF0', eye: '#55C7F3',
    switch: '#FA846F', background: '#D8F0FA', gravity: '#A36FF0', goal: '#FFE875',
    obstacle: '#C9A9E6', door: '#9874C4', grid: '#D8CBE4', ambient: '#FFF7FF', groundLight: '#8B6D9C',
  },
  sky: {
    wall: '#B8DCF0', floor: '#EDF5F8', ceiling: '#D6EDF6', box: '#F28B4F',
    robot: '#5EC3B3', robotFace: '#EFF8F5', joint: '#347D77', eye: '#FFF16B',
    switch: '#ED6B62', background: '#A8E2F5', gravity: '#27A8F2', goal: '#FFE47B',
    obstacle: '#78B9D3', door: '#4B7798', grid: '#C8DFE7', ambient: '#F2FCFF', groundLight: '#5B8294',
  },
  core: {
    wall: '#323956', floor: '#495375', ceiling: '#252B46', box: '#F4CA59',
    robot: '#F1F3F4', robotFace: '#FFFFFF', joint: '#4A5067', eye: '#2DE1DD',
    switch: '#EF6A61', background: '#171D35', gravity: '#37F0DC', goal: '#FFE681',
    obstacle: '#65739B', door: '#7687B2', grid: '#69769A', ambient: '#DDE9FF', groundLight: '#7180A7',
  },
};

function doorway(roomWidth, roomHeight, z, openingWidth, doorHeight, color, glass = false) {
  const sideWidth = (roomWidth - openingWidth) / 2;
  return [
    { id: `${z}-left`, size: [sideWidth, roomHeight, 0.5], position: [-(openingWidth + sideWidth) / 2, roomHeight / 2, z], color, glass },
    { id: `${z}-right`, size: [sideWidth, roomHeight, 0.5], position: [(openingWidth + sideWidth) / 2, roomHeight / 2, z], color, glass },
    { id: `${z}-top`, size: [openingWidth, roomHeight - doorHeight, 0.5], position: [0, doorHeight + (roomHeight - doorHeight) / 2, z], color, glass },
  ];
}

const STAGE_LIBRARY = [
  {
    id: 1,
    name: 'はじめの一歩',
    objective: '箱の重力を変えて、床のスイッチまで運ぼう！',
    hint: '右の壁へ送ったら、もう一度ぬすんで床へ落とそう。',
    palette: palettes.toy,
    room: { width: 18, height: 8, depth: 22 },
    camera: { yaw: 0, pitch: 0.16, distance: 6.5 },
    player: { spawn: [0, 0.8, 5.5] },
    boxes: [{ id: 'box-a', position: [0, 2.15, 3.4], size: 1.35 }],
    switches: [{ id: 'switch-a', position: [7.05, 0.12, 3.4], size: [2.15, 0.22, 2.15], mode: 'latch' }],
    doors: [{ id: 'final-door', position: [0, 1.75, -5.1], size: [3.35, 3.5, 0.42], requires: ['switch-a'] }],
    goal: { position: [0, 0.06, -8.8], radius: 1.65 },
    obstacles: [
      { id: 'pedestal', size: [2.8, 1.18, 2.8], position: [0, 0.59, 3.4], color: '#C6D6DD' },
      ...doorway(18, 8, -5.1, 3.35, 3.5, '#E8BB93'),
    ],
  },
  {
    id: 2,
    name: '壁をこえろ',
    objective: '天井の力で低い壁をこえ、箱をスイッチへ運ぼう！',
    hint: '天井へ上げてもRECALLできるよ。右へ送ってから床へ！',
    palette: palettes.mint,
    room: { width: 18, height: 7, depth: 22 },
    camera: { yaw: 0, pitch: 0.22, distance: 7 },
    player: { spawn: [-4.5, 0.8, 6] },
    boxes: [{ id: 'box-a', position: [-5.1, 1.55, 3.2], size: 1.3 }],
    switches: [{ id: 'switch-a', position: [5.6, 0.12, 3.1], size: [2.1, 0.22, 2.1], mode: 'latch' }],
    doors: [{ id: 'final-door', position: [0, 1.7, -5.4], size: [3.4, 3.4, 0.44], requires: ['switch-a'] }],
    goal: { position: [0, 0.06, -8.8], radius: 1.6 },
    obstacles: [
      { id: 'start-pad', size: [2.8, 0.9, 2.8], position: [-5.1, 0.45, 3.2] },
      { id: 'low-wall', size: [1.2, 3.0, 5.4], position: [0, 1.5, 3.1] },
      ...doorway(18, 7, -5.4, 3.4, 3.4, '#BFE2D3'),
    ],
  },
  {
    id: 3,
    name: 'ふたつの重力',
    objective: '2つの箱で、2つのスイッチを同時に押そう！',
    hint: '光るリングが今の操作対象。片方ずつ落ち着いて運ぼう。',
    palette: palettes.candy,
    room: { width: 20, height: 8, depth: 24 },
    camera: { yaw: 0, pitch: 0.23, distance: 7.4 },
    player: { spawn: [0, 0.8, 7.2] },
    boxes: [
      { id: 'box-a', position: [-4.2, 1.75, 4.8], size: 1.28, color: '#FFD35A' },
      { id: 'box-b', position: [4.2, 1.75, 5.3], size: 1.28, color: '#FFB05D' },
    ],
    switches: [
      { id: 'switch-a', position: [-6.2, 0.12, 0.6], size: [2.05, 0.22, 2.05], mode: 'hold' },
      { id: 'switch-b', position: [6.2, 0.12, -1.6], size: [2.05, 0.22, 2.05], mode: 'hold' },
    ],
    doors: [{ id: 'final-door', position: [0, 1.75, -6.2], size: [3.5, 3.5, 0.44], requires: ['switch-a', 'switch-b'] }],
    goal: { position: [0, 0.06, -10], radius: 1.65 },
    obstacles: [
      { id: 'pad-a', size: [2.5, 0.95, 2.5], position: [-4.2, 0.475, 4.8] },
      { id: 'pad-b', size: [2.5, 0.95, 2.5], position: [4.2, 0.475, 5.3] },
      { id: 'route-wall', size: [1.15, 2.8, 5.5], position: [5.7, 1.4, 2.1] },
      ...doorway(20, 8, -6.2, 3.5, 3.5, '#D8C8EE'),
    ],
  },
  {
    id: 4,
    name: '重力の曲がり角',
    objective: '重力を順番に変えて、曲がり角の先へ運ぼう！',
    hint: '天井→奥→右→床。見えているスイッチへの道を組み立てよう。',
    palette: palettes.sky,
    room: { width: 20, height: 8, depth: 24 },
    camera: { yaw: -0.12, pitch: 0.24, distance: 7.5 },
    player: { spawn: [-5.5, 0.8, 7] },
    boxes: [{ id: 'box-a', position: [-5.2, 1.7, 5], size: 1.3 }],
    switches: [{ id: 'switch-a', position: [5.4, 0.12, -2.7], size: [2.1, 0.22, 2.1], mode: 'latch' }],
    doors: [{ id: 'final-door', position: [0, 1.75, -6.4], size: [3.5, 3.5, 0.44], requires: ['switch-a'] }],
    goal: { position: [0, 0.06, -10.1], radius: 1.65 },
    obstacles: [
      { id: 'start-pad', size: [2.6, 0.9, 2.6], position: [-5.2, 0.45, 5] },
      { id: 'glass-long', size: [1.1, 4.5, 10], position: [0, 2.25, 1.5], glass: true },
      { id: 'glass-turn', size: [7.2, 4.5, 1.1], position: [3.6, 2.25, -3], glass: true },
      ...doorway(20, 8, -6.4, 3.5, 3.5, '#B8DCF0'),
    ],
  },
  {
    id: 5,
    name: '重力コア',
    objective: '2つの箱で中間ゲートと最終扉を開こう！',
    hint: '左のスイッチは一度押せばOK。2つ目の箱をゲートの奥へ運ぼう。',
    palette: palettes.core,
    room: { width: 22, height: 9, depth: 28 },
    camera: { yaw: 0, pitch: 0.27, distance: 8 },
    player: { spawn: [0, 0.8, 10.3] },
    boxes: [
      { id: 'box-a', position: [-6.2, 1.75, 7.2], size: 1.3, color: '#F4CA59' },
      { id: 'box-b', position: [5.7, 3.68, 7.1], size: 1.3, color: '#F0A75C' },
    ],
    switches: [
      { id: 'switch-a', position: [-6.2, 0.12, 1.1], size: [2.15, 0.22, 2.15], mode: 'latch' },
      { id: 'switch-b', position: [6.3, 0.12, -6.6], size: [2.15, 0.22, 2.15], mode: 'hold' },
    ],
    doors: [
      { id: 'middle-gate', position: [0, 1.8, -1.8], size: [3.7, 3.6, 0.48], requires: ['switch-a'] },
      { id: 'final-door', position: [0, 1.8, -9], size: [3.7, 3.6, 0.48], requires: ['switch-b'] },
    ],
    goal: { position: [0, 0.06, -12], radius: 1.75 },
    obstacles: [
      { id: 'pad-a', size: [2.7, 0.95, 2.7], position: [-6.2, 0.475, 7.2] },
      { id: 'pad-b', size: [3, 2.95, 3], position: [5.7, 1.475, 7.1] },
      { id: 'low-a', size: [5.2, 2.1, 1.2], position: [-2.8, 1.05, 4.1] },
      { id: 'low-b', size: [1.2, 3.0, 5], position: [3.3, 1.5, -4.7] },
      ...doorway(22, 9, -1.8, 3.7, 3.6, '#323956'),
      ...doorway(22, 9, -9, 3.7, 3.6, '#323956'),
    ],
  },
];

// Puzzle definitions stay independent from campaign order. The campaign always
// progresses from the simplest single-box lesson to the two-box challenges.
export const FIXED_DIFFICULTY_ORDER = [1, 2, 4, 3, 5];
const CAMPAIGN_PALETTES = [palettes.toy, palettes.mint, palettes.candy, palettes.sky, palettes.core];

export const STAGE_DEFINITIONS = FIXED_DIFFICULTY_ORDER.map((sourceId, index) => {
  const source = STAGE_LIBRARY.find((stage) => stage.id === sourceId);
  const palette = CAMPAIGN_PALETTES[index];
  return {
    ...source,
    id: index + 1,
    palette,
    boxes: source.boxes.map((box) => index < 4 ? { ...box, color: palette.box } : { ...box }),
    obstacles: source.obstacles.map((obstacle) => /-(left|right|top)$/.test(obstacle.id)
      ? { ...obstacle, color: palette.wall }
      : { ...obstacle }),
  };
});

export const STAGE_COUNT = STAGE_DEFINITIONS.length;

export function getStageDefinition(index) {
  return STAGE_DEFINITIONS[Math.min(STAGE_COUNT - 1, Math.max(0, index))];
}
