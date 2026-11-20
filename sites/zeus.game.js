// Données du jeu écrites par l'éditeur T2Z (editor/, docs/ARCHITECTURE.md D1-D3) : priorité sur SITE (sites/<site>.js).
// Le corps est du JSON strict : à modifier de préférence avec l'éditeur (docker compose up -d, http://127.0.0.1:8787/).
const GAME = {
  "barriers": {
    "b1": {
      "x": -2.53,
      "z": 17.43,
      "ang": 1.7,
      "len": 2.37,
      "sw": -1
    },
    "b2": {
      "x": -24.85,
      "z": -3.88,
      "ang": 56.3,
      "len": 1.01,
      "open": true
    },
    "b3": {
      "x": -10.97,
      "z": 27.24,
      "ang": -175.9,
      "len": 2.2,
      "sw": -1
    },
    "b4": {
      "x": -5.06,
      "z": 17.41,
      "ang": -95.7,
      "len": 2.23
    },
    "b5": {
      "x": -27.5,
      "z": 26.85,
      "ang": -29.7,
      "len": 2.2,
      "sw": -1
    }
  },
  "controlRooms": [
    {
      "id": "poste",
      "x": 10.68,
      "z": -3.5,
      "angle": 0,
      "w": 3.75,
      "d": 1.92,
      "main": true
    }
  ],
  "boardAreas": [
    {
      "id": "quai",
      "pts": [
        [
          11.92,
          2.26
        ],
        [
          -8.96,
          1.94
        ],
        [
          -8.96,
          4.63
        ],
        [
          -8.96,
          7.32
        ],
        [
          -5.18,
          7.39
        ],
        [
          -4.4,
          7.89
        ],
        [
          -3.4,
          7.91
        ],
        [
          -2.75,
          7.35
        ],
        [
          12.09,
          7.64
        ],
        [
          12.06,
          4.82
        ]
      ]
    }
  ],
  "board": {
    "depth": 2.29
  },
  "queueEntry": {
    "len": 3.53,
    "ang": -33.8
  }
};
