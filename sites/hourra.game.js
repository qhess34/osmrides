// Données du jeu écrites par l'éditeur T2Z (editor/, docs/ARCHITECTURE.md D1-D3) : priorité sur SITE (sites/<site>.js).
// Le corps est du JSON strict : à modifier de préférence avec l'éditeur (docker compose up -d, http://127.0.0.1:8787/).
const GAME = {
  "barriers": {
    "entry": {
      "x": 57.01,
      "z": 14.7,
      "a": {
        "ang": 113.3,
        "len": 1.06
      },
      "b": {
        "ang": -160.3,
        "len": 1.08
      }
    },
    "fork:boucle nord:fork0": {
      "x": 0.66,
      "z": -11.51,
      "a": {
        "ang": 57.3,
        "len": 0.89
      },
      "b": {
        "ang": 147.7,
        "len": 0.98
      }
    },
    "fork:boucle nord:fork1": {
      "x": 3.32,
      "z": -12.04,
      "a": {
        "ang": 140.6,
        "len": 1.07
      },
      "b": {
        "ang": 43,
        "len": 1
      }
    }
  },
  "controlRooms": [
    {
      "id": "poste",
      "x": 2.13,
      "z": 6.84,
      "angle": -138.1,
      "w": 3.75,
      "d": 1.7,
      "main": true
    }
  ]
};
