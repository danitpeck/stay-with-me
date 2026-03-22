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
var initialState = {
  player: { x: 0, y: 3 },
  partner: { x: 6, y: 3 },
  locked: false,
  lockTurns: 0,
  overlap: false,
  partnerHesitating: false,
  partnerCooldown: 0,
  hp: 3,
  overlapCount: 0,
  overlapTarget: 3,
  lastOverlapType: null,
  gameOver: false,
  won: false,
  turn: 1,
  message: "Arrow keys / WASD to move. Reach the partner!"
};

var state = resetState();
var endScreenStart = null;

function resetState() {
  endScreenStart = null;
  return JSON.parse(JSON.stringify(initialState));
}

// --- input ---
var pendingMove = null;

document.addEventListener("keydown", function (e) {
  // restart from end screens
  if (state.gameOver && (e.key === "r" || e.key === "R" || e.key === " ")) {
    e.preventDefault();
    state = resetState();
    pendingMove = null;
    render();
    return;
  }

  if (pendingMove) return; // one input per turn

  var dx = 0, dy = 0;
  switch (e.key) {
    case "ArrowUp":    case "w": case "W": dy = -1; break;
    case "ArrowDown":  case "s": case "S": dy =  1; break;
    case "ArrowLeft":  case "a": case "A": dx = -1; break;
    case "ArrowRight": case "d": case "D": dx =  1; break;
    case " ": break; // wait
    default: return;
  }
  e.preventDefault();
  pendingMove = { dx: dx, dy: dy };
  if (!state.gameOver) processTurn();
});

// --- turn logic ---
function processTurn() {
  // 1. player action
  if (state.lockTurns > 0) {
    state.lockTurns--;
    state.message = "Turn " + state.turn + ": You're held in place! (locked, " + (state.lockTurns + 1) + " left)";
    if (state.lockTurns === 0) state.locked = false;
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

  // 2. check if player just stepped onto partner → overlap
  var justOverlapped = !state.overlap &&
    state.player.x === state.partner.x && state.player.y === state.partner.y;

  if (justOverlapped) {
    // player initiated overlap — partner stays, no move this turn
    state.overlap = true;
    state.locked = true;
    state.partnerCooldown = 3; // no hesitation for turns after overlap
    if (state.partnerHesitating) {
      // safe overlap — partner was waiting
      state.lockTurns = 1;
      state.hp = Math.min(3, state.hp + 1);
      state.overlapCount++;
      state.lastOverlapType = "gentle";
      if (state.overlapCount >= state.overlapTarget) {
        state.gameOver = true;
        state.won = true;
        state.message = "you stayed with her";
      } else {
        state.message = "Turn " + state.turn + ": Gentle overlap! (" + state.overlapCount + "/" + state.overlapTarget + ")";
      }
    } else {
      // risky overlap — forced, take damage but still counts
      state.hp = Math.max(0, state.hp - 1);
      state.lockTurns = 2;
      state.overlapCount++;
      state.lastOverlapType = "forced";
      if (state.overlapCount >= state.overlapTarget) {
        state.gameOver = true;
        state.won = true;
        state.message = "you didn't wait";
      } else {
        state.message = "Turn " + state.turn + ": Forced overlap! -1 HP, locked for 2 turns. (" + state.overlapCount + "/" + state.overlapTarget + ")";
      }
    }
  } else {
    // 3. partner moves (peels away if overlapping, chases otherwise)
    if (state.partnerCooldown > 0) state.partnerCooldown--;
    movePartner();
    // clear hesitation if partner is on cooldown
    if (state.partnerCooldown > 0) state.partnerHesitating = false;
    state.overlap = false;
    if (!state.message || state.message === "Turn " + state.turn + ": You moved.") {
      state.message = "Turn " + state.turn + ": You moved.";
    }
  }

  // time pressure — every 4 turns, lose 1 HP
  if (!state.gameOver && state.turn > 0 && state.turn % 4 === 0) {
    state.hp = Math.max(0, state.hp - 1);
    state.message = "Turn " + state.turn + ": Time wears on you. -1 HP";
  }

  // check for death
  if (!state.gameOver && state.hp <= 0) {
    state.gameOver = true;
    state.won = false;
    // death from forced overlap vs attrition
    if (state.lastOverlapType === "forced") {
      state.message = "you pushed too hard";
    } else {
      state.message = "the moment passed";
    }
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

  // during cooldown, retreat instead of chasing
  if (state.partnerCooldown > 0) {
    movePartnerAway();
    return;
  }

  // determine candidate step toward player
  var stepX = 0, stepY = 0;
  if (Math.abs(dx) >= Math.abs(dy)) {
    stepX = dx > 0 ? 1 : -1;
  } else {
    stepY = dy > 0 ? 1 : -1;
  }

  var nx = state.partner.x + stepX;
  var ny = state.partner.y + stepY;

  // partner never moves onto the player's tile — only player initiates overlap
  if (nx === state.player.x && ny === state.player.y) {
    // try the other axis toward the player
    stepX = 0; stepY = 0;
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dy !== 0) stepY = dy > 0 ? 1 : -1;
    } else {
      if (dx !== 0) stepX = dx > 0 ? 1 : -1;
    }
    nx = state.partner.x + stepX;
    ny = state.partner.y + stepY;

    if ((stepX === 0 && stepY === 0) || (nx === state.player.x && ny === state.player.y)) {
      // blocked — 60% chance to hesitate, otherwise sidestep immediately
      if (!state.partnerHesitating && Math.random() < 0.6) {
        state.partnerHesitating = true;
        return; // stay put this turn
      }
      // didn't hesitate, or already hesitated last turn — sidestep
      var dirs = [
        { dx:  1, dy:  0 }, { dx: -1, dy:  0 },
        { dx:  0, dy:  1 }, { dx:  0, dy: -1 }
      ];
      var alt = dirs.filter(function (d) {
        var tx = state.partner.x + d.dx;
        var ty = state.partner.y + d.dy;
        return tx >= 0 && tx < COLS && ty >= 0 && ty < ROWS &&
          !(tx === state.player.x && ty === state.player.y);
      });
      if (alt.length > 0) {
        var pick = alt[Math.floor(Math.random() * alt.length)];
        state.partner.x += pick.dx;
        state.partner.y += pick.dy;
      }
      state.partnerHesitating = false;
      return;
    }
  }

  state.partnerHesitating = false;
  state.partner.x = nx;
  state.partner.y = ny;
}

function movePartnerAway() {
  // pick the valid adjacent tile that maximizes distance from player
  var dirs = [
    { dx:  1, dy:  0 },
    { dx: -1, dy:  0 },
    { dx:  0, dy:  1 },
    { dx:  0, dy: -1 }
  ];
  var valid = dirs.filter(function (d) {
    var nx = state.partner.x + d.dx;
    var ny = state.partner.y + d.dy;
    return nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS;
  });
  // sort by Manhattan distance from player (descending), pick best
  valid.sort(function (a, b) {
    var distA = Math.abs(state.player.x - (state.partner.x + a.dx)) +
                Math.abs(state.player.y - (state.partner.y + a.dy));
    var distB = Math.abs(state.player.x - (state.partner.x + b.dx)) +
                Math.abs(state.player.y - (state.partner.y + b.dy));
    return distB - distA;
  });
  var pick = valid[0];
  state.partner.x += pick.dx;
  state.partner.y += pick.dy;
}

// --- rendering ---
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (state.gameOver) {
    if (!endScreenStart) {
      endScreenStart = Date.now();
      info.textContent = "";
      fadeEndScreen();
    }
    return;
  }

  drawGrid();
  drawEntities();
  drawHP();
  drawOverlapProgress();
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
    // partner — dim when hesitating
    if (state.partnerHesitating) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = "#e91e63";
    } else {
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = "#f06292";
    }
    ctx.fillRect(state.partner.x * TILE + pad, state.partner.y * TILE + pad, TILE - pad * 2, TILE - pad * 2);
    ctx.globalAlpha = 1.0;

    // player
    ctx.fillStyle = state.locked ? "#5c6bc0" : "#42a5f5";
    ctx.fillRect(state.player.x * TILE + pad, state.player.y * TILE + pad, TILE - pad * 2, TILE - pad * 2);
  }
}

function drawHP() {
  var x = 8;
  var y = canvas.height - 12;
  ctx.font = "14px monospace";
  ctx.fillStyle = "#eee";
  ctx.fillText("HP: ", x, y);
  var heartX = x + ctx.measureText("HP: ").width;
  for (var i = 0; i < 3; i++) {
    ctx.fillStyle = i < state.hp ? "#ef5350" : "#444";
    ctx.fillText("\u2665", heartX + i * 16, y);
  }
}

function drawOverlapProgress() {
  var text = state.overlapCount + " / " + state.overlapTarget;
  ctx.font = "14px monospace";
  var tw = ctx.measureText(text).width;
  ctx.fillStyle = "#c06ef7";
  ctx.fillText(text, canvas.width - tw - 8, canvas.height - 12);
}

function fadeEndScreen() {
  if (!state.gameOver || !endScreenStart) return;

  var elapsed = Date.now() - endScreenStart;
  // gentle win breathes slower, everything else is quicker
  var isGentle = state.won && state.lastOverlapType === "gentle";
  var fadeDuration = isGentle ? 1500 : 800;
  var hintDelay = fadeDuration + 600;

  var t = Math.min(1, elapsed / fadeDuration);
  // ease-out
  var alpha = t * t;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // background
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalAlpha = alpha;
  ctx.font = "20px monospace";
  if (!state.won) {
    if (state.lastOverlapType === "forced") {
      ctx.fillStyle = "#d47ecf"; // warm purple — forced yourself out
    } else {
      ctx.fillStyle = "#9a8ec0"; // muted lavender — faded, not harsh
    }
  } else if (state.lastOverlapType === "forced") {
    ctx.fillStyle = "#d47ecf"; // warm purple — success, but uneasy
  } else {
    ctx.fillStyle = "#c06ef7"; // cool purple — clean
  }
  ctx.textAlign = "center";
  ctx.fillText(state.message, canvas.width / 2, canvas.height / 2 - 12);
  ctx.globalAlpha = 1;

  // restart hint fades in after the message settles
  if (elapsed > hintDelay) {
    var hintT = Math.min(1, (elapsed - hintDelay) / 600);
    ctx.globalAlpha = hintT * hintT;
    ctx.font = "13px monospace";
    ctx.fillStyle = "#555";
    ctx.fillText("press R to try again", canvas.width / 2, canvas.height / 2 + 20);
    ctx.globalAlpha = 1;
  }

  ctx.textAlign = "left";

  if (alpha < 1 || elapsed < hintDelay + 600) {
    requestAnimationFrame(fadeEndScreen);
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
