module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000/login'], numberOfRuns: 3,
      settings: { chromeFlags: '--no-sandbox --disable-dev-shm-usage' },
    },
    assert: {
      assertions: {
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        // Performance is reported against the target until production/mobile baselines exist.
        'categories:performance': ['warn', { minScore: 0.9 }],
      },
    },
    upload: { target: 'filesystem', outputDir: '/tmp/fashionai-lighthouse' },
  },
};
