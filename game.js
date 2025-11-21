/**
 * Neon Space Shooter
 * Pure HTML5 Canvas Game
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const uiLayer = document.getElementById('ui-layer');
const hud = document.getElementById('hud');
const scoreEl = document.getElementById('score');
const healthBarFill = document.getElementById('health-bar-fill');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl = document.getElementById('final-score-val');
const restartBtn = document.getElementById('restart-btn');

// Game State
let gameState = 'START'; // START, PLAYING, GAMEOVER
let score = 0;
let frames = 0;
let gameLoopId;

// Images
const playerImg = new Image();
playerImg.src = 'player_ship.png';
const enemyImg = new Image();
enemyImg.src = 'enemy_ship.png';
const fireImg = new Image();
fireImg.src = 'icon_fire.png';
const shieldImg = new Image();
shieldImg.src = 'icon_shield.png';
const healthImg = new Image();
healthImg.src = 'icon_health.png';
const bossImg = new Image();
bossImg.src = 'boss_ship.png';
const asteroidImg = new Image();
asteroidImg.src = 'asteroid.png';

// Canvas Resizing
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Input Handling
const input = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    isDown: false
};

function updateInput(x, y) {
    input.x = x;
    input.y = y;
}

// Mouse Events
window.addEventListener('mousemove', (e) => {
    if (gameState === 'PLAYING') {
        updateInput(e.clientX, e.clientY);
    }
});
window.addEventListener('mousedown', () => input.isDown = true);
window.addEventListener('mouseup', () => input.isDown = false);

// Touch Events
window.addEventListener('touchstart', (e) => {
    input.isDown = true;
    const touch = e.touches[0];
    updateInput(touch.clientX, touch.clientY);

    if (gameState === 'START') {
        startGame();
    }
}, { passive: false });

window.addEventListener('touchmove', (e) => {
    e.preventDefault(); // Prevent scrolling
    if (gameState === 'PLAYING') {
        const touch = e.touches[0];
        updateInput(touch.clientX, touch.clientY);
    }
}, { passive: false });

window.addEventListener('touchend', () => input.isDown = false);

// Click to start
window.addEventListener('click', () => {
    if (gameState === 'START') {
        startGame();
    }
});

restartBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent triggering window click
    startGame();
});

// Utility Functions
function random(min, max) {
    return Math.random() * (max - min) + min;
}

function checkCollision(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}

// Sound Manager
class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3; // Lower volume
        this.masterGain.connect(this.ctx.destination);
        this.initialized = false;
        this.bgmInterval = null;
        this.padOsc = null;
        this.padGain = null;
        this.explosionBuffer = null;
    }

    init() {
        if (!this.initialized) {
            this.ctx.resume();
            this.initialized = true;

            // Load explosion sound
            fetch('explode.mp3')
                .then(response => response.arrayBuffer())
                .then(arrayBuffer => this.ctx.decodeAudioData(arrayBuffer))
                .then(audioBuffer => {
                    this.explosionBuffer = audioBuffer;
                })
                .catch(e => console.error("Error loading explosion sound:", e));
        }
    }

    playBackgroundMusic() {
        if (!this.initialized) return;
        if (this.bgmInterval) return; // Already playing

        let step = 0;
        const notes = [87.31, 87.31, 103.83, 116.54]; // F2, F2, G#2, A#2

        // Bass Sequence
        this.bgmInterval = setInterval(() => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(notes[step % 4], this.ctx.currentTime);

            // Low pass filter for bass
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 400;

            gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.5);

            step++;
        }, 500); // 120 BPM

        // Ambient Pad
        this.padOsc = this.ctx.createOscillator();
        this.padGain = this.ctx.createGain();
        this.padOsc.type = 'triangle';
        this.padOsc.frequency.value = 174.61; // F3
        this.padGain.gain.value = 0.05;

        this.padOsc.connect(this.padGain);
        this.padGain.connect(this.masterGain);
        this.padOsc.start();
    }

    stopBackgroundMusic() {
        if (this.bgmInterval) {
            clearInterval(this.bgmInterval);
            this.bgmInterval = null;
        }
        if (this.padOsc) {
            this.padOsc.stop();
            this.padOsc = null;
        }
    }

    playShoot() {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    playExplosion() {
        if (!this.initialized) return;

        if (this.explosionBuffer) {
            const source = this.ctx.createBufferSource();
            source.buffer = this.explosionBuffer;
            source.connect(this.masterGain);
            source.start();
        } else {
            // Fallback if not loaded yet
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const oscGain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, t);
            osc.frequency.exponentialRampToValueAtTime(10, t + 0.3);
            oscGain.gain.setValueAtTime(0.5, t);
            oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
            osc.connect(oscGain);
            oscGain.connect(this.masterGain);
            osc.start();
            osc.stop(t + 0.3);
        }
    }

    playPowerup() {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(880, this.ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }

    playDamage() {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + 0.2);

        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }
}

const audio = new SoundManager();

// Classes

class Collectible {
    constructor() {
        this.width = 50;
        this.height = 50;
        this.x = Math.random() * (canvas.width - this.width);
        this.y = -this.height;
        this.speed = 2;
        const rand = Math.random();
        if (rand < 0.4) this.type = 'MULTI_FIRE';
        else if (rand < 0.8) this.type = 'SHIELD';
        else this.type = 'HEALTH';

        this.color = '#ffffff';
        this.markedForDeletion = false;
        this.angle = 0;
    }

    update() {
        this.y += this.speed;
        this.angle += 0.02;
        if (this.y > canvas.height) this.markedForDeletion = true;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        // ctx.rotate(this.angle); // Don't rotate icons, maybe just bob?

        let img;
        if (this.type === 'MULTI_FIRE') img = fireImg;
        else if (this.type === 'SHIELD') img = shieldImg;
        else if (this.type === 'HEALTH') img = healthImg;

        if (img && img.complete) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = this.type === 'HEALTH' ? '#ff0000' : (this.type === 'MULTI_FIRE' ? '#ffaa00' : '#00ff00');
            ctx.drawImage(img, -this.width / 2, -this.height / 2, this.width, this.height);
        } else {
            // Fallback
            ctx.fillStyle = 'white';
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        }

        ctx.restore();
    }
}

class Star {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2;
        this.speed = Math.random() * 3 + 0.5;
        this.color = `rgba(255, 255, 255, ${Math.random() * 0.5 + 0.1})`;
    }

    update() {
        this.y += this.speed;
        if (this.y > canvas.height) {
            this.y = 0;
            this.x = Math.random() * canvas.width;
        }
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Particle {
    constructor(x, y, color, speed) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = Math.random() * speed + 1;
        this.vx = Math.cos(this.angle) * this.speed;
        this.vy = Math.sin(this.angle) * this.speed;
        this.life = 1.0;
        this.decay = Math.random() * 0.03 + 0.02;
        this.size = Math.random() * 3 + 1;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Bullet {
    constructor(x, y, isEnemy = false) {
        this.width = 5;
        this.height = 15;
        this.x = x - this.width / 2;
        this.y = y;
        this.speed = 7;
        this.vx = 0;
        this.vy = 0;
        this.isEnemy = isEnemy;
        this.color = isEnemy ? '#ff0000' : '#ffff00';
        this.markedForDeletion = false;
        this.damage = 10; // Default damage
    }

    update() {
        this.x += this.vx;
        this.y += (this.vy !== 0 ? this.vy : (this.isEnemy ? this.speed : -this.speed));

        if (this.y < 0 || this.y > canvas.height || this.x < 0 || this.x > canvas.width) {
            this.markedForDeletion = true;
        }
    }

    draw() {
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.shadowBlur = 0;
    }
}

class Player {
    constructor() {
        this.width = 60;
        this.height = 60;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - 100;
        this.speed = 0.1; // Lerp factor
        this.color = '#00f3ff';
        this.health = 100;
        this.maxHealth = 100;
        this.lastShot = 0;
        this.shootDelay = 10; // Frames

        // Power-ups
        this.multiFireTimer = 0;
        this.shieldTimer = 0;
    }

    update() {
        // Smooth movement towards input position (Lerp)
        // Offset input.x by half width to center ship on finger/mouse
        let targetX = input.x - this.width / 2;
        let targetY = input.y - this.height / 2;

        // Clamp to screen
        if (targetX < 0) targetX = 0;
        if (targetX > canvas.width - this.width) targetX = canvas.width - this.width;
        if (targetY < 0) targetY = 0;
        if (targetY > canvas.height - this.height) targetY = canvas.height - this.height;

        this.x += (targetX - this.x) * this.speed * 2; // Multiply by 2 for snappier control
        this.y += (targetY - this.y) * this.speed * 2;

        // Auto fire
        if (frames - this.lastShot > this.shootDelay) {
            if (this.multiFireTimer > 0) {
                // Multi fire: 3 bullets
                bullets.push(new Bullet(this.x + this.width / 2, this.y));
                bullets.push(new Bullet(this.x, this.y + 10)); // Left
                bullets[bullets.length - 1].vx = -2; // Slight spread
                bullets.push(new Bullet(this.x + this.width, this.y + 10)); // Right
                bullets[bullets.length - 1].vx = 2; // Slight spread
            } else {
                // Normal fire
                bullets.push(new Bullet(this.x + this.width / 2, this.y));
            }
            audio.playShoot();
            this.lastShot = frames;
        }

        // Update timers
        if (this.multiFireTimer > 0) this.multiFireTimer--;
        if (this.shieldTimer > 0) this.shieldTimer--;

        // Thruster particles
        if (frames % 2 === 0) {
            particles.push(new Particle(
                this.x + this.width / 2,
                this.y + this.height,
                '#00f3ff',
                2
            ));
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

        if (playerImg.complete) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = this.color;
            ctx.drawImage(playerImg, -this.width / 2, -this.height / 2, this.width, this.height);
        } else {
            // Fallback
            ctx.shadowBlur = 20;
            ctx.shadowColor = this.color;
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, -this.height / 2);
            ctx.lineTo(this.width / 2, this.height / 2);
            ctx.lineTo(-this.width / 2, this.height / 2);
            ctx.closePath();
            ctx.stroke();
        }

        ctx.restore();

        // Draw Shield
        if (this.shieldTimer > 0) {
            ctx.save();
            ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
            ctx.strokeStyle = `rgba(0, 255, 157, ${0.5 + Math.sin(frames * 0.1) * 0.2})`;
            ctx.lineWidth = 3;
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#00ff9d';
            ctx.beginPath();
            ctx.arc(0, 0, this.width, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }

    takeDamage(amount) {
        if (this.shieldTimer > 0) return; // Invincible

        this.health -= amount;
        if (this.health < 0) this.health = 0;

        audio.playDamage();
        this.updateHealthUI();

        // Screen shake effect (simple)
        canvas.style.transform = `translate(${random(-5, 5)}px, ${random(-5, 5)}px)`;
        setTimeout(() => canvas.style.transform = 'none', 50);

        if (this.health <= 0) {
            endGame();
        }
    }

    heal(amount) {
        this.health += amount;
        if (this.health > this.maxHealth) this.health = this.maxHealth;
        this.updateHealthUI();
    }

    updateHealthUI() {
        const healthPercent = (this.health / this.maxHealth) * 100;
        healthBarFill.style.width = `${healthPercent}%`;
    }
}

class Enemy {
    constructor() {
        this.width = 50;
        this.height = 50;
        this.x = Math.random() * (canvas.width - this.width);
        this.y = -this.height;
        this.speed = Math.random() * 2 + 2;
        this.color = '#ff00ff';
        this.markedForDeletion = false;
        this.type = Math.random() > 0.8 ? 'SHOOTER' : 'CHASER';
        this.lastShot = 0;
    }

    update() {
        this.y += this.speed;

        // Tracking behavior for both types
        const dx = (player.x + player.width / 2) - (this.x + this.width / 2);

        if (this.type === 'CHASER') {
            // Aggressive tracking
            this.x += Math.sign(dx) * 1.5;
        } else if (this.type === 'SHOOTER') {
            // Slower tracking
            this.x += Math.sign(dx) * 0.5;

            if (frames - this.lastShot > 100 && Math.random() < 0.02) {
                // Aimed shot
                const startX = this.x + this.width / 2;
                const startY = this.y + this.height;
                const targetX = player.x + player.width / 2;
                const targetY = player.y + player.height / 2;
                const angle = Math.atan2(targetY - startY, targetX - startX);

                const bullet = new Bullet(startX, startY, true);
                bullet.vx = Math.cos(angle) * 5;
                bullet.vy = Math.sin(angle) * 5;
                bullets.push(bullet);

                this.lastShot = frames;
            }
        }

        if (this.y > canvas.height) this.markedForDeletion = true;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

        if (enemyImg.complete) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = this.color;
            ctx.drawImage(enemyImg, -this.width / 2, -this.height / 2, this.width, this.height);
        } else {
            ctx.shadowBlur = 15;
            ctx.shadowColor = this.color;
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;

            // Enemy shape (diamond)
            ctx.beginPath();
            ctx.moveTo(0, -this.height / 2);
            ctx.lineTo(this.width / 2, 0);
            ctx.lineTo(0, this.height / 2);
            ctx.lineTo(-this.width / 2, 0);
            ctx.closePath();
            ctx.stroke();
        }

        ctx.restore();
    }
}

class Asteroid {
    constructor() {
        this.size = Math.random() * 40 + 30;
        this.width = this.size; // Fix collision
        this.height = this.size; // Fix collision
        this.x = Math.random() * (canvas.width - this.size);
        this.y = -this.size;
        this.speed = Math.random() * 1 + 1;
        this.rotation = 0;
        this.rotationSpeed = Math.random() * 0.05 - 0.025;
        this.markedForDeletion = false;
        this.health = 3;
    }

    update() {
        this.y += this.speed;
        this.rotation += this.rotationSpeed;
        if (this.y > canvas.height) this.markedForDeletion = true;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.size / 2, this.y + this.size / 2);
        ctx.rotate(this.rotation);

        if (asteroidImg.complete) {
            ctx.drawImage(asteroidImg, -this.size / 2, -this.size / 2, this.size, this.size);
        } else {
            ctx.fillStyle = '#555';
            ctx.beginPath();
            ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

class Boss {
    constructor() {
        this.width = 150;
        this.height = 150;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = -this.height;
        this.targetY = 50;
        this.speed = 4; // Increased speed
        this.health = 2500;
        this.maxHealth = 2500;
        this.state = 'ENTERING'; // ENTERING, FIGHTING
        this.targetX = this.x; // Target for random movement
        this.lastShot = 0;
        this.markedForDeletion = false;

        // Attack Logic
        this.attackState = 'SPREAD'; // SPREAD, RAPID, OMNI
        this.attackTimer = 0;
        this.attackDuration = 300; // 5 seconds per state
    }

    update() {
        if (this.state === 'ENTERING') {
            this.y += this.speed;
            if (this.y >= this.targetY) {
                this.y = this.targetY;
                this.state = 'FIGHTING';
            }
        } else if (this.state === 'FIGHTING') {
            // Track Player
            this.targetX = player.x + player.width / 2 - this.width / 2;

            // Move towards targetX
            const dx = this.targetX - this.x;
            if (Math.abs(dx) > this.speed) {
                this.x += Math.sign(dx) * this.speed;
            } else {
                this.x = this.targetX;
            }

            // Attack State Machine
            this.attackTimer++;
            if (this.attackTimer > this.attackDuration) {
                this.attackTimer = 0;
                // Cycle states
                if (this.attackState === 'SPREAD') this.attackState = 'RAPID';
                else if (this.attackState === 'RAPID') this.attackState = 'OMNI';
                else this.attackState = 'SPREAD';
            }

            // Execute Attack
            if (this.attackState === 'SPREAD') this.fireSpread();
            else if (this.attackState === 'RAPID') this.fireRapid();
            else if (this.attackState === 'OMNI') this.fireOmniBurst();
        }
    }

    fireSpread() {
        if (frames - this.lastShot > 60) { // Slow fire rate
            for (let i = -2; i <= 2; i++) {
                const bullet = new Bullet(this.x + this.width / 2, this.y + this.height, true);
                bullet.vx = i * 2;
                bullet.damage = 20; // Boss damage
                bullets.push(bullet);
            }
            audio.playShoot();
            this.lastShot = frames;
        }
    }

    fireRapid() {
        if (frames - this.lastShot > 10) { // Fast fire rate
            const startX = this.x + this.width / 2;
            const startY = this.y + this.height;
            const targetX = player.x + player.width / 2;
            const targetY = player.y + player.height / 2;

            const angle = Math.atan2(targetY - startY, targetX - startX);

            const bullet = new Bullet(startX, startY, true);
            bullet.vx = Math.cos(angle) * 8; // Aimed shot
            bullet.vy = Math.sin(angle) * 8;
            bullet.damage = 20; // Boss damage

            bullets.push(bullet);
            audio.playShoot();
            this.lastShot = frames;
        }
    }

    fireOmniBurst() {
        if (frames - this.lastShot > 120) { // Very slow fire rate
            const numBullets = 20;
            for (let i = 0; i < numBullets; i++) {
                const angle = (Math.PI * 2 / numBullets) * i;
                const bullet = new Bullet(this.x + this.width / 2 + Math.cos(angle) * 40, this.y + this.height / 2 + Math.sin(angle) * 40, true);
                bullet.vx = Math.cos(angle) * 4;
                bullet.vy = Math.sin(angle) * 4;
                bullet.damage = 20; // Boss damage
                bullets.push(bullet);
            }
            audio.playExplosion(); // Use explosion sound for big burst
            this.lastShot = frames;
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

        if (bossImg.complete) {
            ctx.shadowBlur = 30;
            ctx.shadowColor = '#ff0000';
            ctx.drawImage(bossImg, -this.width / 2, -this.height / 2, this.width, this.height);
        } else {
            ctx.fillStyle = 'red';
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        }
        ctx.restore();

        // Boss Health Bar
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(canvas.width / 2 - 100, 10, 200, 20);
        ctx.fillStyle = 'red';
        ctx.fillRect(canvas.width / 2 - 100, 10, 200 * (this.health / this.maxHealth), 20);
        ctx.strokeStyle = 'white';
        ctx.strokeRect(canvas.width / 2 - 100, 10, 200, 20);
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.markedForDeletion = true;
            score += 1000;
            createExplosion(this.x + this.width / 2, this.y + this.height / 2, '#ff00ff', 50);
            audio.playExplosion();
        }
    }
}

// Game Objects
let player;
let bullets = [];
let enemies = [];
let particles = [];
let stars = [];
let collectibles = [];
let asteroids = [];
let boss = null;
// let bossSpawned = false; // Removed in favor of nextBossScore

function init() {
    player = new Player();
    bullets = [];
    enemies = [];
    particles = [];
    stars = [];
    collectibles = [];
    asteroids = [];
    boss = null;
    nextBossScore = 2000;
    score = 0;
    frames = 0;
    scoreEl.innerText = score;
    healthBarFill.style.width = '100%';

    // Create starfield
    for (let i = 0; i < 100; i++) {
        stars.push(new Star());
    }
}

function spawnEnemy() {
    if (boss) return; // Don't spawn normal enemies during boss fight
    if (frames % 60 === 0) { // Spawn every second approx
        enemies.push(new Enemy());
    }
}

function spawnAsteroid() {
    if (frames % 120 === 0) { // Every 2 seconds
        asteroids.push(new Asteroid());
    }
}

function spawnCollectible() {
    if (frames % 600 === 0) { // Spawn every 10 seconds approx
        collectibles.push(new Collectible());
    }
}

// Boss Logic
let nextBossScore = 2000;

function update() {
    // Background
    ctx.fillStyle = 'rgba(5, 5, 5, 0.3)'; // Trail effect
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Stars
    stars.forEach(star => {
        star.update();
        star.draw();
    });

    // Player
    player.update();
    player.draw();

    // Bullets
    bullets.forEach((bullet, index) => {
        bullet.update();
        bullet.draw();

        // Check collision with player if it's an enemy bullet
        if (bullet.isEnemy && checkCollision(bullet, player)) {
            player.takeDamage(bullet.damage || 10);
            bullet.markedForDeletion = true;
            createExplosion(bullet.x, bullet.y, '#ff0000', 5);
            audio.playDamage();
        }

        if (bullet.markedForDeletion) bullets.splice(index, 1);
    });

    // Boss Logic
    if (!boss && score >= nextBossScore) {
        boss = new Boss();
        nextBossScore += 2000; // Next boss at +2000 points
        // Clear existing enemies
        enemies.forEach(e => {
            createExplosion(e.x, e.y, e.color);
            e.markedForDeletion = true;
        });
    }

    if (boss) {
        boss.update();
        boss.draw();

        if (checkCollision(player, boss)) {
            player.takeDamage(2); // Continuous damage on contact (Increased)
        }

        bullets.forEach(bullet => {
            if (!bullet.isEnemy && checkCollision(bullet, boss)) {
                boss.takeDamage(10);
                bullet.markedForDeletion = true;
                createExplosion(bullet.x, bullet.y, '#ff0000', 3);
            }
        });

        if (boss.markedForDeletion) {
            boss = null;
            // Reset for next boss? or Win?
            // Let's just keep playing without boss for now, or spawn another at 5000?
            // For this task, one boss is enough.
        }
    }

    // Asteroids
    asteroids.forEach((asteroid, index) => {
        asteroid.update();
        asteroid.draw();

        if (checkCollision(player, asteroid)) {
            player.takeDamage(50); // Massive damage
            asteroid.markedForDeletion = true;
            createExplosion(asteroid.x, asteroid.y, '#ff4400', 30); // Larger, fiery explosion
            audio.playDamage();
        }

        bullets.forEach(bullet => {
            if (!bullet.isEnemy && checkCollision(bullet, asteroid)) {
                asteroid.health--;
                bullet.markedForDeletion = true;
                createExplosion(bullet.x, bullet.y, '#aaa', 3);
                if (asteroid.health <= 0) {
                    asteroid.markedForDeletion = true;
                    score += 50;
                    scoreEl.innerText = score;
                    createExplosion(asteroid.x, asteroid.y, '#888', 15);
                    audio.playExplosion();
                }
            }
        });

        if (asteroid.markedForDeletion) asteroids.splice(index, 1);
    });

    // Enemies
    enemies.forEach((enemy, index) => {
        enemy.update();
        enemy.draw();

        // Collision: Enemy vs Player
        if (checkCollision(player, enemy)) {
            player.takeDamage(20);
            enemy.markedForDeletion = true;
            createExplosion(enemy.x, enemy.y, enemy.color);
            audio.playExplosion();
        }

        // Collision: Bullet vs Enemy
        bullets.forEach((bullet, bIndex) => {
            if (!bullet.isEnemy) {
                // Bullet hitting enemy
                if (checkCollision(bullet, enemy)) {
                    enemy.markedForDeletion = true;
                    bullet.markedForDeletion = true;
                    score += 100;
                    scoreEl.innerText = score;
                    createExplosion(enemy.x, enemy.y, enemy.color);
                    audio.playExplosion();
                }
            }
        });

        if (enemy.markedForDeletion) enemies.splice(index, 1);
    });

    spawnEnemy();
    spawnCollectible();
    spawnAsteroid();

    // Collectibles
    collectibles.forEach((collectible, index) => {
        collectible.update();
        collectible.draw();

        if (checkCollision(player, collectible)) {
            if (collectible.type === 'MULTI_FIRE') {
                player.multiFireTimer = 600; // 10 seconds
            } else if (collectible.type === 'SHIELD') {
                player.shieldTimer = 600; // 10 seconds
            } else if (collectible.type === 'HEALTH') {
                player.heal(25);
            }
            collectible.markedForDeletion = true;
            createExplosion(collectible.x, collectible.y, collectible.color, 10);
            audio.playPowerup();
        }

        if (collectible.markedForDeletion) collectibles.splice(index, 1);
    });

    // Particles
    particles.forEach((particle, index) => {
        particle.update();
        particle.draw();
        if (particle.life <= 0) particles.splice(index, 1);
    });

    frames++;
    if (gameState === 'PLAYING') {
        gameLoopId = requestAnimationFrame(update);
    }
}

function createExplosion(x, y, color, count = 15) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color, 5));
    }
}

function startGame() {
    audio.init();
    audio.playBackgroundMusic();
    gameState = 'PLAYING';
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    init();
    update();
}

function endGame() {
    gameState = 'GAMEOVER';
    cancelAnimationFrame(gameLoopId);
    audio.stopBackgroundMusic();
    hud.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
    finalScoreEl.innerText = score;
}

// Initial Render
resize();
// Draw one frame of stars for background
ctx.fillStyle = '#050505';
ctx.fillRect(0, 0, canvas.width, canvas.height);
for (let i = 0; i < 100; i++) {
    let s = new Star();
    s.draw();
}
