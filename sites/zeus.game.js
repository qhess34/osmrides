// Données du jeu écrites par l'éditeur T2Z (editor/, docs/ARCHITECTURE.md D1-D3) : priorité sur SITE (sites/<site>.js).
// Le corps est du JSON strict : à modifier de préférence avec l'éditeur (docker compose up -d, http://127.0.0.1:8787/).
const GAME = {
  "barriers": {
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
  ]
};
