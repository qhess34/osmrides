// Données du jeu écrites par l'éditeur T2Z (editor/, docs/ARCHITECTURE.md D1-D3) : priorité sur SITE (sites/<site>.js).
// Le corps est du JSON strict : à modifier de préférence avec l'éditeur (docker compose up -d, http://127.0.0.1:8787/).
const GAME = {
  "barriers": {
    "add:raccourci est:1": {
      "x": -2.53,
      "z": 17.43,
      "a": {
        "ang": 1.7,
        "len": 2.37
      },
      "b": {
        "ang": -90.6,
        "len": 1.98
      }
    },
    "entry": {
      "x": -29.14,
      "z": -5.98,
      "a": {
        "ang": -11.6,
        "len": 1
      },
      "b": {
        "ang": 78.4,
        "len": 1
      }
    },
    "fork:raccourci est:fork0": {
      "x": -10.97,
      "z": 27.24,
      "a": {
        "ang": -175.9,
        "len": 2.2
      },
      "b": {
        "ang": 98.7,
        "len": 2.2
      }
    },
    "fork:raccourci est:fork1": {
      "x": -5.06,
      "z": 17.41,
      "a": {
        "ang": -95.7,
        "len": 2.23
      },
      "b": {
        "ang": 1.4,
        "len": 2.2
      }
    },
    "fork:raccourci ouest:fork0": {
      "x": -27.5,
      "z": 26.85,
      "a": {
        "ang": -29.7,
        "len": 2.2
      },
      "b": {
        "ang": -122,
        "len": 2.15
      }
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
  ]
};
