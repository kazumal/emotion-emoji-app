// DOM要素の取得
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const emojiContainer = document.getElementById('emoji-container');
const startButton = document.getElementById('start-button');
const stopButton = document.getElementById('stop-button');
const statusElement = document.getElementById('status');
const emotionResultElement = document.getElementById('emotion-result');
const snapshotButton = document.getElementById('snapshot-button');
const snapshotsContainer = document.getElementById('snapshots');

// キャンバスのコンテキスト
const ctx = canvas.getContext('2d');

// ストリーム保存用の変数
let stream = null;
let currentEmotion = 'neutral';
let detectInterval = null;

// 感情と絵文字のマッピング
const emotionEmojis = {
    happy: '😄',
    sad: '😢',
    angry: '😠',
    surprised: '😲',
    fearful: '😨',
    disgusted: '🤢',
    neutral: '😐'
};

// 日本語の感情名
const emotionNames = {
    happy: '喜び',
    sad: '悲しみ',
    angry: '怒り',
    surprised: '驚き',
    fearful: '恐怖',
    disgusted: '嫌悪',
    neutral: '無表情'
};

// アプリの初期化
async function init() {
    startButton.disabled = true;
    stopButton.disabled = true;
    statusElement.textContent = 'モデルを読み込み中...';
    
    try {
        // モデルのパス
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.2/model/';
        
        // Face-api.jsのモデルを読み込む
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
        ]);
        
        statusElement.textContent = 'モデルの読み込みが完了しました。「カメラ開始」ボタンをクリックしてください。';
        startButton.disabled = false;
    } catch (error) {
        statusElement.textContent = `エラー: ${error.message}`;
        console.error('モデルの読み込み中にエラーが発生しました:', error);
    }
}

// カメラを開始
async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
            audio: false
        });
        
        video.srcObject = stream;
        
        // ビデオのサイズに合わせてキャンバスのサイズを設定
        video.addEventListener('loadedmetadata', () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        });
        
        startButton.disabled = true;
        stopButton.disabled = false;
        statusElement.textContent = 'カメラが起動しました。表情を分析しています...';
        
        // 顔検出と感情分析を開始
        startDetection();
    } catch (error) {
        statusElement.textContent = `カメラへのアクセスエラー: ${error.message}`;
        console.error('カメラへのアクセス中にエラーが発生しました:', error);
    }
}

// カメラを停止
function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        stream = null;
    }
    
    // 検出インターバルをクリア
    if (detectInterval) {
        clearInterval(detectInterval);
        detectInterval = null;
    }
    
    // キャンバスをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 絵文字コンテナをクリア
    emojiContainer.innerHTML = '';
    
    // 感情結果をリセット
    emotionResultElement.textContent = 'まだ検出されていません';
    
    startButton.disabled = false;
    stopButton.disabled = true;
    statusElement.textContent = 'カメラが停止しました。「カメラ開始」ボタンをクリックして再開できます。';
}

// 顔検出と感情分析
function startDetection() {
    if (!stream) return;
    
    // 定期的に顔検出と感情分析を実行
    detectInterval = setInterval(async () => {
        if (!stream) {
            clearInterval(detectInterval);
            return;
        }
        
        try {
            // 顔検出と感情分析を実行
            const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceExpressions();
            
            // キャンバスをクリア
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // 絵文字コンテナをクリア
            emojiContainer.innerHTML = '';
            
            // 検出結果を表示
            if (detections.length > 0) {
                // キャンバスのサイズをビデオに合わせる
                const displaySize = { width: video.videoWidth, height: video.videoHeight };
                faceapi.matchDimensions(canvas, displaySize);
                
                // 検出結果をリサイズ
                const resizedDetections = faceapi.resizeResults(detections, displaySize);
                
                // 各顔に対して処理
                resizedDetections.forEach(detection => {
                    // 顔の位置に枠を描画
                    const box = detection.detection.box;
                    ctx.strokeStyle = '#4169e1';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(box.x, box.y, box.width, box.height);
                    
                    // 最も確率の高い感情を取得
                    const expressions = detection.expressions;
                    let maxExpression = 'neutral';
                    let maxProbability = 0;
                    
                    for (const [expression, probability] of Object.entries(expressions)) {
                        if (probability > maxProbability) {
                            maxExpression = expression;
                            maxProbability = probability;
                        }
                    }
                    
                    // 現在の感情を更新
                    currentEmotion = maxExpression;
                    
                    // 感情に対応する絵文字を表示
                    const emoji = document.createElement('div');
                    emoji.className = 'emoji';
                    emoji.textContent = emotionEmojis[maxExpression] || '😐';
                    emoji.style.left = `${box.x + box.width / 2 - 20}px`;
                    emoji.style.top = `${box.y - 50}px`;
                    emojiContainer.appendChild(emoji);
                    
                    // 感情結果を表示
                    const emotionName = emotionNames[maxExpression] || '不明';
                    const probability = Math.round(maxProbability * 100);
                    
                    // メイン感情の表示
                    let resultHTML = `
                        <div class="emotion-result-header">
                            <span class="emotion-name">${emotionName}</span>
                            <span class="emotion-emoji">${emotionEmojis[maxExpression]}</span>
                        </div>
                        <div class="emotion-probability">
                            <div class="probability-bar">
                                <div class="probability-fill" style="width: ${probability}%"></div>
                            </div>
                            <div class="probability-text">${probability}%</div>
                        </div>
                        <div class="all-emotions-title">すべての感情:</div>
                        <div class="all-emotions">
                    `;
                    
                    // すべての感情の種類と確率を表示
                    for (const [expression, probability] of Object.entries(expressions)) {
                        const prob = Math.round(probability * 100);
                        const name = emotionNames[expression] || expression;
                        resultHTML += `
                            <div class="emotion-item">
                                <div class="emotion-item-header">
                                    <span class="emotion-item-name">${name}</span>
                                    <span class="emotion-item-emoji">${emotionEmojis[expression]}</span>
                                </div>
                                <div class="emotion-item-probability">
                                    <div class="probability-bar">
                                        <div class="probability-fill" style="width: ${prob}%"></div>
                                    </div>
                                    <div class="probability-text">${prob}%</div>
                                </div>
                            </div>
                        `;
                    }
                    
                    resultHTML += `</div>`;
                    emotionResultElement.innerHTML = resultHTML;
                });
            } else {
                emotionResultElement.textContent = '顔が検出されていません';
            }
        } catch (error) {
            console.error('顔検出中にエラーが発生しました:', error);
        }
    }, 100); // 100ミリ秒ごとに実行
}

// スナップショットを撮影
function takeSnapshot() {
    if (!stream) {
        statusElement.textContent = 'スナップショットを撮影するにはカメラを開始してください。';
        return;
    }
    
    // 一時的なキャンバスを作成
    const snapshotCanvas = document.createElement('canvas');
    snapshotCanvas.width = video.videoWidth;
    snapshotCanvas.height = video.videoHeight;
    
    // ビデオフレームをキャンバスに描画
    const snapshotCtx = snapshotCanvas.getContext('2d');
    snapshotCtx.drawImage(video, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
    
    // 現在のキャンバスの内容も描画（顔の枠など）
    snapshotCtx.drawImage(canvas, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
    
    // スナップショット要素を作成
    const snapshot = document.createElement('div');
    snapshot.className = 'snapshot';
    
    // 画像要素を作成
    const img = document.createElement('img');
    img.src = snapshotCanvas.toDataURL('image/png');
    snapshot.appendChild(img);
    
    // 絵文字オーバーレイを作成
    const emojiOverlay = document.createElement('div');
    emojiOverlay.className = 'emoji-overlay';
    emojiOverlay.textContent = emotionEmojis[currentEmotion];
    snapshot.appendChild(emojiOverlay);
    
    // スナップショットをコンテナに追加
    snapshotsContainer.appendChild(snapshot);
    
    statusElement.textContent = 'スナップショットを撮影しました！';
    
    // 少し経ったらステータスを元に戻す
    setTimeout(() => {
        if (stream) {
            statusElement.textContent = 'カメラが起動しています。表情を分析しています...';
        }
    }, 2000);
}

// イベントリスナーの設定
document.addEventListener('DOMContentLoaded', init);
startButton.addEventListener('click', startCamera);
stopButton.addEventListener('click', stopCamera);
snapshotButton.addEventListener('click', takeSnapshot);

// ブラウザがページを離れる際にカメラを停止
window.addEventListener('beforeunload', stopCamera);
