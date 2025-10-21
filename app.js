
// ===========================
// Health Insurance Cross-Sell
// TensorFlow.js web app (browser)
// ===========================

// Global state
let trainData = null;
let testData = null;
let preprocessedTrain = null;
let preprocessedTest = null;
let model = null;
let valX = null, valY = null, valPred = null;
let testPred = null;

// --------- SCHEMA (edit here) ----------
const TARGET_FEATURE = 'Response';
const ID_FEATURE = 'id';
// Numeric features (scaled): treat Region_Code & Policy_Sales_Channel as numeric for simplicity
const NUMERIC_FEATURES = ['Age', 'Annual_Premium', 'Vintage', 'Region_Code', 'Policy_Sales_Channel'];
// Binary-as-numeric too:
// const BINARY_FEATURES = ['Driving_License', 'Previously_Insured']; // we'll keep them as numeric
const BINARY_FEATURES = ['Driving_License', 'Previously_Insured'];
// Low-cardinality categoricals (one-hot)
const CATEGORICAL_MAP = {
  'Gender': ['Male', 'Female'],
  'Vehicle_Age': ['< 1 Year', '1-2 Year', '> 2 Years'],
  'Vehicle_Damage': ['Yes', 'No']
};

// -------------- IO -----------------
async function loadData() {
  const trainFile = document.getElementById('train-file')?.files?.[0];
  const testFile = document.getElementById('test-file')?.files?.[0];
  const status = document.getElementById('data-status');
  if (!trainFile) { alert('Upload a training CSV (train.csv).'); return; }
  status.innerHTML = 'Loading CSV...';

  try {
    const trainText = await readFile(trainFile);
    trainData = parseCSV(trainText);
    if (testFile) {
      const testText = await readFile(testFile);
      testData = parseCSV(testText);
    } else {
      // Allow workflow without a separate test file
      testData = trainData.map(r => ({...r}));
    }
    status.innerHTML = `Loaded! Train: ${trainData.length} rows, Test: ${testData.length} rows.`;
    document.getElementById('inspect-btn').disabled = false;
  } catch (e) {
    status.innerHTML = 'Error: ' + e.message;
    console.error(e);
  }
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = e => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim() !== '');
  if (!lines.length) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      const v = i < values.length ? values[i] : '';
      obj[h] = v === '' ? null : (!isNaN(v) && v.trim() !== '' ? parseFloat(v) : v);
    });
    return obj;
  });
}

function parseCSVLine(line) {
  const res = []; let cur = ''; let inQ = false;
  for (let i=0;i<line.length;i++) {
    const ch = line[i];
    if (ch === '"') inQ = !inQ;
    else if (ch === ',' && !inQ) { res.push(cur.trim()); cur=''; }
    else cur += ch;
  }
  res.push(cur.trim());
  return res;
}

// -------------- INSPECT / EDA -----------------
function inspectData() {
  if (!trainData?.length) { alert('Load data first'); return; }
  const preview = document.getElementById('data-preview');
  const stats = document.getElementById('data-stats');
  preview.innerHTML = '<h3>Preview (first 10)</h3>';
  preview.appendChild(tableFrom(trainData.slice(0,10)));

  // Basic stats
  const shape = `Rows: ${trainData.length} | Cols: ${Object.keys(trainData[0]).length}`;
  const pos = trainData.filter(r => Number(r[TARGET_FEATURE]) === 1).length;
  const rate = (100*pos/trainData.length).toFixed(2);
  let missing = '<ul>';
  Object.keys(trainData[0]).forEach(f => {
    const miss = trainData.reduce((a,r)=>a+((r[f]===null||r[f]===undefined)?1:0),0);
    missing += `<li>${f}: ${(100*miss/trainData.length).toFixed(2)}%</li>`;
  });
  missing += '</ul>';
  stats.innerHTML = `<p>${shape}</p><p>Positive rate (Response=1): ${rate}%</p><h4>Missing:</h4>${missing}`;

  renderCharts();
  document.getElementById('preprocess-btn').disabled = true; // will re-enable after charts
  // small timeout so tfjs-vis can mount
  setTimeout(()=> document.getElementById('preprocess-btn').disabled = false, 200);
}

function tableFrom(rows) {
  const table = document.createElement('table');
  const tr = document.createElement('tr');
  Object.keys(rows[0]).forEach(h => {
    const th = document.createElement('th'); th.textContent=h; tr.appendChild(th);
  });
  table.appendChild(tr);
  rows.forEach(r => {
    const trd = document.createElement('tr');
    Object.values(r).forEach(v => {
      const td = document.createElement('td'); td.textContent = v ?? 'NULL'; trd.appendChild(td);
    }); table.appendChild(trd);
  });
  return table;
}

function renderCharts() {
  const tab = 'Charts';
  // Response by Vehicle_Damage
  const agg = groupRate(trainData, 'Vehicle_Damage');
  tfvis.render.barchart({name:'Response Rate by Vehicle Damage', tab}, aggToSeries(agg), {
    xLabel:'Vehicle_Damage', yLabel:'Response rate (%)', yAxisDomain:[0,100]
  });

  // Response by Previously_Insured
  const aggPI = groupRate(trainData, 'Previously_Insured');
  tfvis.render.barchart({name:'Response Rate by Previously_Insured', tab}, aggToSeries(aggPI), {
    xLabel:'Previously_Insured', yLabel:'Response rate (%)', yAxisDomain:[0,100]
  });

  // Age histogram (positive vs negative)
  const bins = histByLabel(trainData, 'Age', TARGET_FEATURE, 10);
  tfvis.render.linechart({name:'Age distribution (by Response)', tab},
    [{values: bins.pos, series:'Response=1'}, {values: bins.neg, series:'Response=0'}],
    {xLabel:'Age bin (min edge)', yLabel:'Count'}
  );

  // Premium histogram
  const pBins = histByLabel(trainData, 'Annual_Premium', TARGET_FEATURE, 12);
  tfvis.render.linechart({name:'Annual_Premium distribution (by Response)', tab},
    [{values: pBins.pos, series:'Response=1'}, {values: pBins.neg, series:'Response=0'}],
    {xLabel:'Premium bin (min edge)', yLabel:'Count'}
  );
}

function groupRate(data, col) {
  const m = {};
  data.forEach(r => {
    const k = String(r[col]);
    if (!m[k]) m[k]={pos:0,tot:0};
    if (Number(r[TARGET_FEATURE])===1) m[k].pos++;
    m[k].tot++;
  });
  return Object.entries(m).map(([k,v])=>({index:k, value: 100*(v.pos/v.tot)}));
}
function aggToSeries(arr){ return arr.map(o=>({index:o.index, value:o.value})); }

function histByLabel(data, feature, target, bins) {
  const vals = data.map(r=> Number(r[feature])).filter(v=>!isNaN(v));
  const min = Math.min(...vals), max = Math.max(...vals);
  const step = (max-min)/bins;
  const edge = Array.from({length:bins}, (_,i)=>min+i*step);
  const pos = edge.map((e,i)=>({x:e, y:0}));
  const neg = edge.map((e,i)=>({x:e, y:0}));
  data.forEach(r=>{
    const v = Number(r[feature]);
    if (isNaN(v)) return;
    let b = Math.min(bins-1, Math.max(0, Math.floor((v-min)/step)));
    if (Number(r[target])===1) pos[b].y++; else neg[b].y++;
  });
  return {pos, neg};
}

// -------------- PREPROCESS -----------------
function preprocessData() {
  if (!trainData) { alert('Load data first'); return; }
  const out = document.getElementById('preprocessing-output');
  out.innerHTML = 'Preprocessing...';

  // Compute medians/std for numeric
  const numStats = {};
  NUMERIC_FEATURES.concat(BINARY_FEATURES).forEach(f => {
    const arr = trainData.map(r=> toNum(r[f])).filter(v=>v!=null);
    const med = median(arr);
    const sd = stddev(arr);
    numStats[f] = {median: med, sd: sd || 1};
  });

  // Prepare features/labels
  const X = [], y = [];
  trainData.forEach(r => {
    const feat = [];
    // numeric + binary (standardized)
    NUMERIC_FEATURES.concat(BINARY_FEATURES).forEach(f=>{
      const v = r[f]==null ? numStats[f].median : toNum(r[f]);
      const z = (v - numStats[f].median) / (numStats[f].sd || 1);
      feat.push(z);
    });
    // one-hot categoricals
    Object.entries(CATEGORICAL_MAP).forEach(([col, cats])=>{
      const oh = oneHot(r[col], cats);
      feat.push(...oh);
    });
    X.push(feat);
    y.push(Number(r[TARGET_FEATURE]));
  });

  // Train/val split
  const n = X.length, split = Math.floor(n*0.8);
  const Xtf = tf.tensor2d(X), ytf = tf.tensor1d(y);
  const xTrain = Xtf.slice([0,0],[split, Xtf.shape[1]]);
  const yTrain = ytf.slice(0, split);
  valX = Xtf.slice([split,0],[n-split, Xtf.shape[1]]);
  valY = ytf.slice(split);

  // Basic minority oversampling on training
  const yArr = y.slice(0, split);
  const posIdx = yArr.map((v,i)=>v===1?i:-1).filter(i=>i>=0);
  const negIdx = yArr.map((v,i)=>v===0?i:-1).filter(i=>i>=0);
  const targetCount = Math.max(posIdx.length, negIdx.length);
  function resample(indices) {
    const out = [];
    while (out.length < targetCount) {
      out.push(indices[Math.floor(Math.random()*indices.length)]);
    }
    return out;
  }
  const posS = resample(posIdx);
  const negS = resample(negIdx);
  const allIdx = posS.concat(negS);
  const xTrainRS = tf.gather(xTrain, tf.tensor1d(allIdx, 'int32'));
  const yTrainRS = tf.gather(yTrain, tf.tensor1d(allIdx, 'int32'));

  preprocessedTrain = { X:xTrainRS, y:yTrainRS };

  // Preprocess test using same stats
  const Xt = [];
  testData.forEach(r => {
    const feat = [];
    NUMERIC_FEATURES.concat(BINARY_FEATURES).forEach(f=>{
      const v = r[f]==null ? numStats[f].median : toNum(r[f]);
      const z = (v - numStats[f].median) / (numStats[f].sd || 1);
      feat.push(z);
    });
    Object.entries(CATEGORICAL_MAP).forEach(([col, cats])=>{
      const oh = oneHot(r[col], cats);
      feat.push(...oh);
    });
    Xt.push(feat);
  });
  preprocessedTest = { X: tf.tensor2d(Xt), ids: testData.map(r=>r[ID_FEATURE]) };

  out.innerHTML = `
    <p>Done.</p>
    <p>Train (resampled) shape: [${preprocessedTrain.X.shape}]</p>
    <p>Val shape: [${valX.shape}]</p>
    <p>Test shape: [${preprocessedTest.X.shape}]</p>
  `;

  document.getElementById('create-model-btn').disabled = false;
}

function toNum(v){ const n = Number(v); return isNaN(n)? null : n; }
function median(a){ const s=[...a].sort((x,y)=>x-y); const h=Math.floor(s.length/2); return s.length%2? s[h] : (s[h-1]+s[h])/2; }
function stddev(a){ const m=a.reduce((p,c)=>p+c,0)/a.length; const v=a.reduce((p,c)=>p+(c-m)**2,0)/a.length; return Math.sqrt(v); }
function oneHot(v, cats){ const idx = cats.indexOf(v); return cats.map((_,i)=> i===idx?1:0); }

// -------------- MODEL -----------------
function createModel() {
  if (!preprocessedTrain) { alert('Preprocess first'); return; }
  const inDim = preprocessedTrain.X.shape[1];
  model = tf.sequential();
  model.add(tf.layers.dense({units: 32, activation:'relu', inputShape:[inDim]}));
  model.add(tf.layers.dropout({rate:0.2}));
  model.add(tf.layers.dense({units: 16, activation:'relu'}));
  model.add(tf.layers.dense({units: 1, activation:'sigmoid'}));
  model.compile({optimizer: tf.train.adam(0.001), loss: 'binaryCrossentropy', metrics: ['accuracy']});

  const sum = document.getElementById('model-summary');
  sum.innerHTML = '<h3>Model</h3>' +
    `<p>Input dim: ${inDim}</p>` +
    `<p>Layers: Dense(32, relu) → Dropout(0.2) → Dense(16, relu) → Dense(1, sigmoid)</p>` +
    `<p>Params: ${model.countParams()}</p>`;

  document.getElementById('train-btn').disabled = false;
}

// -------------- TRAIN -----------------
async function trainModel() {
  const status = document.getElementById('training-status');
  status.innerHTML = 'Training...';
  const cb = tfvis.show.fitCallbacks({name:'Training Performance'}, ['loss','acc','val_loss','val_acc'], {callbacks:['onEpochEnd']});
  const hist = await model.fit(preprocessedTrain.X, preprocessedTrain.y, {
    epochs: 40, batchSize: 64, validationData: [valX, valY],
    callbacks: {
      onEpochEnd: async (epoch, logs) => {
        cb.onEpochEnd?.(epoch, logs);
        status.innerHTML = `Epoch ${epoch+1}/40 — loss: ${logs.loss.toFixed(4)} acc: ${logs.acc.toFixed(4)} | val_loss: ${logs.val_loss.toFixed(4)} val_acc: ${logs.val_acc.toFixed(4)}`;
      }
    }
  });
  status.innerHTML += '<p>Finished.</p>';
  valPred = model.predict(valX);
  document.getElementById('threshold-slider').disabled = false;
  document.getElementById('predict-btn').disabled = false;
  updateMetrics();
}

// -------------- EVAL -----------------
async function updateMetrics() {
  if (!valPred || !valY) return;
  const thr = parseFloat(document.getElementById('threshold-slider').value);
  document.getElementById('threshold-value').textContent = thr.toFixed(2);

  const preds = (await valPred.data()).map(p => p >= thr ? 1 : 0);
  const trues = await valY.array();
  let tp=0, tn=0, fp=0, fn=0;
  for (let i=0;i<preds.length;i++){
    if (preds[i]===1 && trues[i]===1) tp++;
    else if (preds[i]===0 && trues[i]===0) tn++;
    else if (preds[i]===1 && trues[i]===0) fp++;
    else if (preds[i]===0 && trues[i]===1) fn++;
  }
  const precision = tp/(tp+fp)||0;
  const recall = tp/(tp+fn)||0;
  const f1 = 2*(precision*recall)/(precision+recall)||0;
  const acc = (tp+tn)/(tp+tn+fp+fn)||0;

  document.getElementById('confusion-matrix').innerHTML = `
    <table style="border-collapse:collapse;width:100%">
      <tr><th></th><th>Pred Pos</th><th>Pred Neg</th></tr>
      <tr><th>Actual Pos</th><td>${tp}</td><td>${fn}</td></tr>
      <tr><th>Actual Neg</th><td>${fp}</td><td>${tn}</td></tr>
    </table>`;
  document.getElementById('performance-metrics').innerHTML = `
    <p>Accuracy: ${(acc*100).toFixed(2)}%</p>
    <p>Precision: ${precision.toFixed(4)}</p>
    <p>Recall: ${recall.toFixed(4)}</p>
    <p>F1: ${f1.toFixed(4)}</p>`;

  await plotROC(await valY.array(), await valPred.array());
  await plotPR(await valY.array(), await valPred.array());
}

async function plotROC(trues, probs) {
  const thresholds = Array.from({length:101}, (_,i)=>i/100);
  const pts = thresholds.map(t => {
    let tp=0, fp=0, tn=0, fn=0;
    for (let i=0;i<probs.length;i++){
      const p = probs[i][0] >= t ? 1:0;
      const y = trues[i];
      if (y===1){ if (p===1) tp++; else fn++; }
      else { if (p===1) fp++; else tn++; }
    }
    const tpr = tp/(tp+fn)||0;
    const fpr = fp/(fp+tn)||0;
    return {x:fpr, y:tpr};
  });
  // AUC (trapezoid)
  let auc=0;
  for (let i=1;i<pts.length;i++){ auc += (pts[i].x-pts[i-1].x) * (pts[i].y+pts[i-1].y)/2; }
  tfvis.render.linechart({name:'ROC Curve', tab:'Evaluation'}, [{values:pts, series:'ROC'}], {xLabel:'FPR', yLabel:'TPR'});
  const m = document.getElementById('performance-metrics'); m.innerHTML += `<p>AUC: ${auc.toFixed(4)}</p>`;
}

async function plotPR(trues, probs) {
  const thresholds = Array.from({length:101}, (_,i)=>i/100);
  const pts = thresholds.map(t => {
    let tp=0, fp=0, fn=0;
    for (let i=0;i<probs.length;i++){
      const p = probs[i][0] >= t ? 1:0;
      const y = trues[i];
      if (p===1 && y===1) tp++;
      else if (p===1 && y===0) fp++;
      else if (p===0 && y===1) fn++;
    }
    const precision = tp/(tp+fp)||0;
    const recall = tp/(tp+fn)||0;
    return {x:recall, y:precision};
  });
  tfvis.render.linechart({name:'Precision-Recall Curve', tab:'Evaluation'}, [{values:pts, series:'PR'}], {xLabel:'Recall', yLabel:'Precision'});
}

// -------------- PREDICT / EXPORT -----------------
async function predict() {
  if (!preprocessedTest) { alert('Preprocess first'); return; }
  const out = document.getElementById('prediction-output');
  out.innerHTML = 'Predicting...';
  testPred = model.predict(preprocessedTest.X);
  const probs = await testPred.data();
  const results = preprocessedTest.ids.map((id, i) => ({
    id: id,
    Response: probs[i] >= 0.5 ? 1 : 0,
    Probability: probs[i]
  }));
  out.innerHTML = '<h3>First 10 predictions</h3>';
  out.appendChild(predTable(results.slice(0,10)));
  document.getElementById('export-btn').disabled = false;
}

function predTable(rows){
  const table = document.createElement('table');
  const tr = document.createElement('tr');
  ['id','Response','Probability'].forEach(h=>{ const th=document.createElement('th'); th.textContent=h; tr.appendChild(th); });
  table.appendChild(tr);
  rows.forEach(r=>{
    const trd = document.createElement('tr');
    ['id','Response','Probability'].forEach(k=>{
      const td=document.createElement('td');
      td.textContent = k==='Probability' ? Number(r[k]).toFixed(4) : r[k];
      trd.appendChild(td);
    });
    table.appendChild(trd);
  });
  return table;
}

async function exportResults(){
  if (!testPred || !preprocessedTest) { alert('Predict first'); return; }
  const probs = await testPred.data();
  let submission = 'id,Response\n';
  preprocessedTest.ids.forEach((id,i)=>{ submission += `${id},${probs[i] >= 0.5 ? 1 : 0}\n`; });
  let probabilities = 'id,Probability\n';
  preprocessedTest.ids.forEach((id,i)=>{ probabilities += `${id},${probs[i].toFixed(6)}\n`; });

  const link1 = document.createElement('a');
  link1.href = URL.createObjectURL(new Blob([submission], {type:'text/csv'}));
  link1.download = 'submission.csv';
  link1.click();

  const link2 = document.createElement('a');
  link2.href = URL.createObjectURL(new Blob([probabilities], {type:'text/csv'}));
  link2.download = 'probabilities.csv';
  link2.click();

  await model.save('downloads://health-insurance-tfjs-model');

  const status = document.getElementById('export-status');
  status.innerHTML = '<p>Exported submission.csv, probabilities.csv, and saved model to downloads.</p>';
}

// -------------- VISOR TOGGLE -----------------
function toggleVisor(){
  const visor = tfvis.visor();
  if (visor.isOpen()) visor.close(); else visor.open();
}

// -------------- DOM HOOKS -----------------
document.addEventListener('DOMContentLoaded', () => {
  // optional: close visor on load
  try{ tfvis.visor().close(); } catch(e){}
});

// Expose functions to window (for HTML buttons)
window.loadData = loadData;
window.inspectData = inspectData;
window.preprocessData = preprocessData;
window.createModel = createModel;
window.trainModel = trainModel;
window.updateMetrics = updateMetrics;
window.predict = predict;
window.exportResults = exportResults;
window.toggleVisor = toggleVisor;
