// --- constants ---
var COLS = 7;
var ROWS = 7;
var TILE = 64;
var canvas = document.getElementById("game");
var ctx = canvas.getContext("2d");
canvas.width = COLS * TILE;
canvas.height = ROWS * TILE;

var info = document.getElementById("info");

// --- game state ---
var state = {
  player: { x: 0, y: 3 },
  partner: { x: 6, y: 3 },
  locked: false,
  overlap: false,
  turn: 1,
  message: "Arrow keys / WASD to move. Reach the partner!"
};

// --- input ---
var pendingMove = null;

document.addEventListener("keydown", function (e) {
  if (pendingMove) return; // one input per turn

  var dx = 0, dy = 0;
  switch (e.key) {
    case "ArrowUp":    case "w": case "W": dy = -1; break;
    case "ArrowDown":  case "s": case "S": dy =  1; break;
    case "ArrowLeft":  case "a": case "A": dx = -1; break;
    case "ArrowRight": case "d": case "D": dx =  1; break;
    default: return;
  }
  e.preventDefault();
  pendingMove = { dx: dx, dy: dy };
  processTurn();
});

// --- turn logic ---
function processTurn() {
  // 1. player action
  if (state.locked) {
    state.message = "Turn " + state.turn + ": You're held in place! (locked)";
    state.locked = false;
  } else if (pendingMove) {
    var nx = state.player.x + pendingMove.dx;
    var ny = state.player.y + pendingMove.dy;
    if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
      state.player.x = nx;
      state.player.y = ny;
    }
    state.message = "Turn " + state.turn + ": You moved.";
  }
  pendingMove = null;

  // 2. partner moves toward player
  movePartner();

  // 3. check overlap (transient event)
  var wasOverlap = state.overlap;
  state.overlap = (state.player.x === state.partner.x && state.player.y === state.partner.y);
  if (state.overlap) {
    state.locked = true;
    state.message = "Turn " + state.turn + ": Overlap! You'll be locked next turn.";
  } else if (wasOverlap) {
    state.overlap = false; // clear after the separation
  }

  state.turn++;
  render();
}

function movePartner() {
  var dx = state.player.x - state.partner.x;
  var dy = state.player.y - state.partner.y;

  // if already overlapping, move one tile away instead of staying
  if (dx === 0 && dy === 0) {
    movePartnerAway();
    return;
  }

  // move along the axis with the greater distance; break ties with horizontal
  if (Math.abs(dx) >= Math.abs(dy)) {
    state.partner.x += dx > 0 ? 1 : -1;
  } else {
    state.partner.y += dy > 0 ? 1 : -1;
  }
}

function movePartnerAway() {
  // pick a random valid adjacent tile to step away
  var dirs = [
    { dx:  1, dy:  0 },
    { dx: -1, dy:  0 },
    { dx:  0, dy:  1 },
    { dx:  0, dy: -1 }
  ];
  // filter to in-bounds moves
  var valid = dirs.filter(function (d) {
    var nx = state.partner.x + d.dx;
    var ny = state.partner.y + d.dy;
    return nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS;
  });
  var pick = valid[Math.floor(Math.random() * valid.length)];
  state.partner.x += pick.dx;
  state.partner.y += pick.dy;
}

// --- rendering ---
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawEntities();
  info.textContent = state.message;
}

function drawGrid() {
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;
  for (var x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * TILE, 0);
    ctx.lineTo(x * TILE, ROWS * TILE);
    ctx.stroke();
  }
  for (var y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * TILE);
    ctx.lineTo(COLS * TILE, y * TILE);
    ctx.stroke();
  }
}

function drawEntities() {
  var pad = 6; // padding inside tile

  if (state.overlap) {
    // overlap glow effect
    drawGlow(state.player.x, state.player.y);
    ctx.fillStyle = "#c06ef7";
    ctx.fillRect(state.player.x * TILE + pad, state.player.y * TILE + pad, TILE - pad * 2, TILE - pad * 2);
  } else {
    // partner
    ctx.fillStyle = "#f06292";
    ctx.fillRect(state.partner.x * TILE + pad, state.partner.y * TILE + pad, TILE - pad * 2, TILE - pad * 2);

    // player
    ctx.fillStyle = state.locked ? "#5c6bc0" : "#42a5f5";
    ctx.fillRect(state.player.x * TILE + pad, state.player.y * TILE + pad, TILE - pad * 2, TILE - pad * 2);
  }
}

function drawGlow(gx, gy) {
  var cx = gx * TILE + TILE / 2;
  var cy = gy * TILE + TILE / 2;
  var grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, TILE);
  grad.addColorStop(0, "rgba(200, 120, 255, 0.6)");
  grad.addColorStop(1, "rgba(200, 120, 255, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(gx * TILE, gy * TILE, TILE, TILE);
}

// initial draw
render();
