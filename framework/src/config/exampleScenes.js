// Example scene configuration used by the BasicMap example.
// This demonstrates how you might structure scenes, sites, and grids
// in a real application without including any proprietary data.

export const EXAMPLE_SCENES = {
  'scene-0': {
    id: 'scene-0',
    title: 'Two Grids, Two Campuses',
    description:
      'Example pattern: two independent grids (A/B) and two campuses within ~100 miles to illustrate grid redundancy vs single-grid risk.',
    sites: [
      {
        id: 'site-east',
        name: 'Grid A East Campus',
        grid: 'A',
        utility: 'Utility A',
      },
      {
        id: 'site-west',
        name: 'Grid B West Campus',
        grid: 'B',
        utility: 'Utility B',
      },
    ],
  },

  'scene-1': {
    id: 'scene-1',
    title: 'Single Grid, Multiple Sites',
    description:
      'Contrast pattern: multiple campuses on one grid to illustrate exposure to a single-grid bottleneck.',
    sites: [
      {
        id: 'site-a',
        name: 'Grid A Campus 1',
        grid: 'A',
        utility: 'Utility A',
      },
      {
        id: 'site-b',
        name: 'Grid A Campus 2',
        grid: 'A',
        utility: 'Utility A',
      },
      {
        id: 'site-c',
        name: 'Grid A Campus 3',
        grid: 'A',
        utility: 'Utility A',
      },
    ],
  },
};

export const getExampleScene = (sceneId = 'scene-0') => {
  return EXAMPLE_SCENES[sceneId] || EXAMPLE_SCENES['scene-0'];
};

