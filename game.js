class SnakeGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gridSize = 20;
        this.snake = [{x: 5, y: 5}];
        this.direction = 'right';
        this.score = 0;
        this.lives = 1;
        this.highScore = localStorage.getItem('snakeHighScore') || 0;
        this.gameInterval = null;
        this.isPaused = false;
        this.isGameOver = false;
        this.speedMultiplier = 1;
        this.baseSpeed = 200;
        this.currentSpeed = this.baseSpeed;
        this.effects = [];

        // 使用在线音效资源
        this.sounds = {
            // 更清脆的吃食物音效
            eat: new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'),
            // 可爱的特殊食物音效
            powerup: new Audio('https://assets.mixkit.co/active_storage/sfx/2575/2575-preview.mp3'),
            // 温和的游戏结束音效
            die: new Audio('https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3')
        };

        // 使用可靠的音乐源作为背景音乐
        this.bgMusic = new Audio('https://assets.mixkit.co/active_storage/sfx/123/123-preview.mp3');
        this.bgMusic.loop = true;
        this.bgMusic.volume = 0.25;

        // 备用轻音乐列表
        this.backupMusic = [
            'https://assets.mixkit.co/active_storage/sfx/95/95-preview.mp3',
            'https://assets.mixkit.co/active_storage/sfx/140/140-preview.mp3',
            'https://assets.mixkit.co/active_storage/sfx/142/142-preview.mp3'
        ];

        // 增强的音乐错误处理
        this.bgMusic.onerror = () => {
            console.log('主背景音乐加载失败，尝试备用音乐');
            this.tryNextBackupMusic();
        };

        // 尝试播放下一个备用音乐的方法
        this.currentBackupIndex = 0;
        this.tryNextBackupMusic = () => {
            if (this.currentBackupIndex < this.backupMusic.length) {
                const musicUrl = this.backupMusic[this.currentBackupIndex];
                try {
                    const newMusic = new Audio(musicUrl);
                    newMusic.loop = true;
                    newMusic.volume = 0.25;
                    newMusic.onerror = () => {
                        console.log(`备用音乐 ${this.currentBackupIndex + 1} 加载失败，尝试下一个`);
                        this.currentBackupIndex++;
                        this.tryNextBackupMusic();
                    };
                    newMusic.oncanplay = () => {
                        console.log(`成功加载备用音乐 ${this.currentBackupIndex + 1}`);
                        this.bgMusic = newMusic;
                        if (document.getElementById('musicToggle').checked) {
                            this.bgMusic.play().catch(err => console.log('备用音乐播放失败:', err));
                        }
                    };
                    newMusic.load();
                } catch (err) {
                    console.log(`备用音乐 ${this.currentBackupIndex + 1} 加载出错:`, err);
                    this.currentBackupIndex++;
                    this.tryNextBackupMusic();
                }
            } else {
                console.log('所有音乐源都无法播放');
            }
        };

        // 预加载音效和音乐
        Object.values(this.sounds).forEach(sound => {
            sound.load();
            sound.volume = 0.4;
        });
        this.bgMusic.load();

        // 初始化食物
        this.food = this.generateFood();
        this.foodType = 'normal';
        
        // 更新最高分显示
        document.getElementById('highScore').textContent = this.highScore;
        
        // 绑定事件
        this.bindEvents();
        
        // 绘制网格背景
        this.drawGrid();
    }

    bindEvents() {
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        // 难度选择
        document.getElementById('difficulty').addEventListener('change', (e) => {
            switch(e.target.value) {
                case 'easy':
                    this.baseSpeed = 200;
                    break;
                case 'medium':
                    this.baseSpeed = 150;
                    break;
                case 'hard':
                    this.baseSpeed = 100;
                    break;
            }
            this.currentSpeed = this.baseSpeed / this.speedMultiplier;
            if (this.gameInterval) {
                clearInterval(this.gameInterval);
                this.gameInterval = setInterval(() => this.move(), this.currentSpeed);
            }
        });

        // 修复背景音乐控制
        const musicToggle = document.getElementById('musicToggle');
        musicToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                // 确保音乐只播放一次
                if (this.bgMusic.paused) {
                    this.bgMusic.play().catch(err => {
                        console.log('背景音乐播放失败，尝试重新加载:', err);
                        this.bgMusic.load();
                        this.bgMusic.play().catch(err => {
                            console.log('重试播放失败，尝试备用音乐:', err);
                            this.tryNextBackupMusic();
                        });
                    });
                }
            } else {
                this.bgMusic.pause();
                this.bgMusic.currentTime = 0;
            }
        });

        // 初始化时检查音乐开关状态
        if (!musicToggle.checked) {
            this.bgMusic.pause();
            this.bgMusic.currentTime = 0;
        }
    }

    drawGrid() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        for (let i = 0; i <= this.canvas.width; i += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(i, 0);
            this.ctx.lineTo(i, this.canvas.height);
            this.ctx.stroke();
        }
        for (let i = 0; i <= this.canvas.height; i += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, i);
            this.ctx.lineTo(this.canvas.width, i);
            this.ctx.stroke();
        }
    }

    generateFood() {
        const x = Math.floor(Math.random() * (this.canvas.width / this.gridSize));
        const y = Math.floor(Math.random() * (this.canvas.height / this.gridSize));
        
        // 随机生成特殊食物
        const rand = Math.random();
        if (rand < 0.1) {
            this.foodType = 'golden';  // 金色食物：加速+高分
        } else if (rand < 0.2) {
            this.foodType = 'heart';   // 红心食物：增加生命
        } else if (rand < 0.3) {
            this.foodType = 'lightning'; // 闪电食物：减速
        } else {
            this.foodType = 'normal';
        }
        
        return {x, y};
    }

    drawSquare(x, y, color, isFood = false) {
        this.ctx.fillStyle = color;
        if (isFood) {
            // 绘制圆形食物
            this.ctx.beginPath();
            this.ctx.arc(
                (x + 0.5) * this.gridSize,
                (y + 0.5) * this.gridSize,
                this.gridSize / 2 - 2,
                0,
                Math.PI * 2
            );
            this.ctx.fill();
            
            if (this.foodType !== 'normal') {
                // 添加光晕效果
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = color;
                this.ctx.fill();
                this.ctx.shadowBlur = 0;
            }
        } else {
            // 绘制蛇身
            this.ctx.fillRect(
                x * this.gridSize,
                y * this.gridSize,
                this.gridSize - 2,
                this.gridSize - 2
            );
        }
    }

    draw() {
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 重绘网格
        this.drawGrid();

        // 绘制蛇
        this.snake.forEach((segment, index) => {
            // 创建渐变色
            const hue = (index * 10) % 360;
            const color = `hsl(${hue}, 100%, 50%)`;
            this.drawSquare(segment.x, segment.y, color);
        });

        // 绘制食物
        let foodColor;
        switch(this.foodType) {
            case 'golden':
                foodColor = '#FFD700';
                break;
            case 'heart':
                foodColor = '#FF69B4';
                break;
            case 'lightning':
                foodColor = '#00FFFF';
                break;
            default:
                foodColor = '#FF0000';
        }
        this.drawSquare(this.food.x, this.food.y, foodColor, true);

        // 显示生命值
        this.ctx.fillStyle = '#FF0000';
        for (let i = 0; i < this.lives; i++) {
            this.ctx.fillText('❤️', 10 + i * 20, 20);
        }
    }

    move() {
        const head = {...this.snake[0]};

        switch(this.direction) {
            case 'up': head.y--; break;
            case 'down': head.y++; break;
            case 'left': head.x--; break;
            case 'right': head.x++; break;
        }

        // 实现穿墙功能
        const gridWidth = this.canvas.width / this.gridSize;
        const gridHeight = this.canvas.height / this.gridSize;

        // 如果穿过墙壁，从另一边出现
        if (head.x < 0) head.x = gridWidth - 1;
        if (head.x >= gridWidth) head.x = 0;
        if (head.y < 0) head.y = gridHeight - 1;
        if (head.y >= gridHeight) head.y = 0;

        // 检查是否吃到食物
        if (head.x === this.food.x && head.y === this.food.y) {
            // 播放音效
            if (document.getElementById('soundToggle').checked) {
                if (this.foodType === 'normal') {
                    this.sounds.eat.currentTime = 0;
                    this.sounds.eat.play().catch(err => console.log('音效播放失败:', err));
                } else {
                    // 特殊食物音效
                    this.sounds.powerup.currentTime = 0;
                    this.sounds.powerup.play().catch(err => console.log('音效播放失败:', err));
                }
            }

            // 处理不同类型的食物效果
            switch(this.foodType) {
                case 'golden':
                    this.score += 30;
                    this.addEffect('speed', 5000);  // 加速5秒
                    break;
                case 'heart':
                    this.score += 20;
                    this.lives++;
                    break;
                case 'lightning':
                    this.score += 15;
                    this.addEffect('slow', 5000);   // 减速5秒
                    break;
                default:
                    this.score += 10;
            }

            document.getElementById('score').textContent = this.score;
            if (this.score > this.highScore) {
                this.highScore = this.score;
                localStorage.setItem('snakeHighScore', this.highScore);
                document.getElementById('highScore').textContent = this.highScore;
            }
            
            this.food = this.generateFood();
        } else {
            this.snake.pop();
        }

        // 检查游戏是否结束
        if (this.checkCollision(head)) {
            if (this.lives > 1) {
                this.lives--;
                return;
            }
            this.gameOver();
            return;
        }

        this.snake.unshift(head);
        this.draw();
    }

    addEffect(type, duration) {
        switch(type) {
            case 'speed':
                this.speedMultiplier = 1.5;
                break;
            case 'slow':
                this.speedMultiplier = 0.5;
                break;
        }
        
        this.currentSpeed = this.baseSpeed / this.speedMultiplier;
        if (this.gameInterval) {
            clearInterval(this.gameInterval);
            this.gameInterval = setInterval(() => this.move(), this.currentSpeed);
        }

        setTimeout(() => {
            this.speedMultiplier = 1;
            this.currentSpeed = this.baseSpeed;
            if (this.gameInterval) {
                clearInterval(this.gameInterval);
                this.gameInterval = setInterval(() => this.move(), this.currentSpeed);
            }
        }, duration);
    }

    checkCollision(head) {
        // 移除撞墙检测，只检查是否撞到自己
        return this.snake.some(segment => segment.x === head.x && segment.y === head.y);
    }

    handleKeyPress(e) {
        if (this.isPaused || this.isGameOver) return;

        switch(e.key) {
            case 'ArrowUp':
                if (this.direction !== 'down') this.direction = 'up';
                break;
            case 'ArrowDown':
                if (this.direction !== 'up') this.direction = 'down';
                break;
            case 'ArrowLeft':
                if (this.direction !== 'right') this.direction = 'left';
                break;
            case 'ArrowRight':
                if (this.direction !== 'left') this.direction = 'right';
                break;
        }
    }

    startGame() {
        if (this.gameInterval || this.isGameOver) return;
        this.gameInterval = setInterval(() => this.move(), this.currentSpeed);
        document.getElementById('startBtn').disabled = true;

        // 开始游戏时检查音乐开关状态并尝试播放
        const musicToggle = document.getElementById('musicToggle');
        if (musicToggle.checked) {
            this.bgMusic.play().catch(err => {
                console.log('背景音乐播放失败，尝试重新加载:', err);
                this.bgMusic.load();
                this.bgMusic.play().catch(err => {
                    console.log('重试播放失败，尝试备用音乐:', err);
                    this.tryNextBackupMusic();
                });
            });
        }
    }

    togglePause() {
        if (this.isGameOver) return;
        
        if (this.isPaused) {
            this.gameInterval = setInterval(() => this.move(), this.currentSpeed);
            document.getElementById('pauseBtn').textContent = '暂停';
            // 继续播放背景音乐
            if (document.getElementById('musicToggle').checked) {
                this.bgMusic.play().catch(e => console.log('背景音乐播放失败:', e));
            }
        } else {
            clearInterval(this.gameInterval);
            this.gameInterval = null;
            document.getElementById('pauseBtn').textContent = '继续';
            // 暂停背景音乐
            this.bgMusic.pause();
        }
        this.isPaused = !this.isPaused;
    }

    gameOver() {
        if (document.getElementById('soundToggle').checked) {
            this.sounds.die.currentTime = 0;
            this.sounds.die.play().catch(e => console.log('音效播放失败:', e));
        }

        // 停止背景音乐
        this.bgMusic.pause();
        this.bgMusic.currentTime = 0;

        clearInterval(this.gameInterval);
        this.gameInterval = null;
        this.isGameOver = true;
        
        // 绘制游戏结束画面
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = 'white';
        this.ctx.font = '30px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('游戏结束!', this.canvas.width / 2, this.canvas.height / 2 - 30);
        this.ctx.font = '20px Arial';
        this.ctx.fillText(`最终得分: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 10);
        
        document.getElementById('startBtn').disabled = false;
    }

    restartGame() {
        this.snake = [{x: 5, y: 5}];
        this.direction = 'right';
        this.food = this.generateFood();
        this.score = 0;
        this.lives = 1;
        this.speedMultiplier = 1;
        this.currentSpeed = this.baseSpeed;
        document.getElementById('score').textContent = '0';
        this.isGameOver = false;
        this.isPaused = false;
        document.getElementById('pauseBtn').textContent = '暂停';
        document.getElementById('startBtn').disabled = false;
        clearInterval(this.gameInterval);
        this.gameInterval = null;

        // 重新开始时重置并播放背景音乐
        this.bgMusic.currentTime = 0;
        if (document.getElementById('musicToggle').checked) {
            this.bgMusic.play().catch(e => console.log('背景音乐播放失败:', e));
        }

        this.draw();
    }
}

// 初始化游戏
window.onload = () => {
    new SnakeGame();
};
