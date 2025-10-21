// Global variables
let trainData = null;
let testData = null;
let preprocessedTrainData = null;
let preprocessedTestData = null;
let model = null;
let trainingHistory = null;
let validationData = null;
let validationLabels = null;
let validationPredictions = null;
let testPredictions = null;

// Schema configuration for Health Insurance dataset
const TARGET_FEATURE = 'Response';
const ID_FEATURE = 'id';
const NUMERICAL_FEATURES = ['Age', 'Region_Code', 'Annual_Premium', 'Policy_Sales_Channel', 'Vintage'];
const CATEGORICAL_FEATURES = ['Gender', 'Driving_License', 'Previously_Insured', 'Vehicle_Age', 'Vehicle_Damage'];

// Configuration for large datasets
const MAX_SAMPLES_FOR_TRAINING = 20000; // Reduced for stability
const BATCH_SIZE = 50; // Smaller batches

// Load data from uploaded CSV files
async function loadData() {
    const trainFile = document.getElementById('train-file').files[0];
    const testFile = document.getElementById('test-file').files[0];
    
    if (!trainFile || !testFile) {
        alert('Please upload both training and test CSV files.');
        return;
    }
    
    const statusDiv = document.getElementById('data-status');
    statusDiv.innerHTML = 'Loading data...';
    
    try {
        console.log('Starting data loading...');
        
        // Load training data
        const trainText = await readFile(trainFile);
        trainData = parseCSV(trainText);
        console.log('Training data loaded:', trainData.length, 'rows');
        
        // Load test data
        const testText = await readFile(testFile);
        testData = parseCSV(testText);
        console.log('Test data loaded:', testData.length, 'rows');
        
        statusDiv.innerHTML = `
            <div class="status success">
                <strong>Data loaded successfully!</strong><br>
                Training: ${trainData.length.toLocaleString()} samples<br>
                Test: ${testData.length.toLocaleString()} samples
                ${trainData.length > MAX_SAMPLES_FOR_TRAINING ? 
                    `<br><small>Large dataset detected. Will use sampling (${MAX_SAMPLES_FOR_TRAINING.toLocaleString()} samples) for better performance.</small>` : ''
                }
            </div>
        `;
        
        // Enable the inspect button
        document.getElementById('inspect-btn').disabled = false;
    } catch (error) {
        console.error('Error loading data:', error);
        statusDiv.innerHTML = `<div class="status error">Error loading data: ${error.message}</div>`;
    }
}

// Read file as text
function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = e => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

// Parse CSV text to array of objects
function parseCSV(csvText) {
    console.log('Parsing CSV...');
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return [];
    
    // Parse headers first
    const headers = parseCSVLine(lines[0]);
    console.log('Headers:', headers);
    
    const data = lines.slice(1).map((line, index) => {
        const values = parseCSVLine(line);
        const obj = {};
        headers.forEach((header, i) => {
            obj[header] = i < values.length && values[i] !== '' ? values[i] : null;
            
            // Convert numerical values to numbers if possible
            if (obj[header] !== null && !isNaN(obj[header]) && obj[header] !== '') {
                obj[header] = parseFloat(obj[header]);
            }
        });
        return obj;
    });
    
    console.log('First row sample:', data[0]);
    return data;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current.trim());
    return result;
}

// Inspect the loaded data
function inspectData() {
    if (!trainData || trainData.length === 0) {
        alert('Please load data first.');
        return;
    }
    
    console.log('Inspecting data...');
    
    // Show data preview
    const previewDiv = document.getElementById('data-preview');
    previewDiv.innerHTML = '<h3>Data Preview (First 10 Rows)</h3>';
    previewDiv.appendChild(createPreviewTable(trainData.slice(0, 10)));
    
    // Calculate and show data statistics
    const statsDiv = document.getElementById('data-stats');
    statsDiv.innerHTML = '<h3>Data Statistics</h3>';
    
    const shapeInfo = `Dataset shape: ${trainData.length.toLocaleString()} rows x ${Object.keys(trainData[0]).length} columns`;
    const interestCount = trainData.filter(row => row[TARGET_FEATURE] === 1).length;
    const interestRate = (interestCount / trainData.length * 100).toFixed(2);
    const targetInfo = `Interest rate: ${interestCount.toLocaleString()}/${trainData.length.toLocaleString()} (${interestRate}%)`;
    
    statsDiv.innerHTML += `<p>${shapeInfo}</p><p>${targetInfo}</p>`;
    
    // Create visualizations
    createVisualizations();
    
    // Enable the preprocess button
    document.getElementById('preprocess-btn').disabled = false;
}

// Create a preview table from data
function createPreviewTable(data) {
    const table = document.createElement('table');
    table.className = 'data-table';
    
    // Create header row
    const headerRow = document.createElement('tr');
    Object.keys(data[0]).forEach(key => {
        const th = document.createElement('th');
        th.textContent = key;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);
    
    // Create data rows
    data.forEach(row => {
        const tr = document.createElement('tr');
        Object.values(row).forEach(value => {
            const td = document.createElement('td');
            td.textContent = value !== null ? value : 'NULL';
            tr.appendChild(td);
        });
        table.appendChild(tr);
    });
    
    // Create container for scrolling
    const container = document.createElement('div');
    container.className = 'table-container';
    container.appendChild(table);
    
    return container;
}

// Create visualizations using tfjs-vis
function createVisualizations() {
    console.log('Creating visualizations...');
    const chartsDiv = document.getElementById('charts');
    chartsDiv.innerHTML = '<h3>Data Visualizations</h3>';
    
    try {
        // Use sampling for large datasets
        const sampleSize = Math.min(2000, trainData.length);
        const sampledData = trainData.length > 2000 ? 
            trainData.filter((_, index) => index % Math.ceil(trainData.length / sampleSize) === 0) : 
            trainData;
        
        console.log(`Using ${sampledData.length} samples for visualization`);
        
        // Interest by Gender
        const interestByGender = {};
        sampledData.forEach(row => {
            if (row.Gender && row.Response !== undefined && row.Response !== null) {
                if (!interestByGender[row.Gender]) {
                    interestByGender[row.Gender] = { interested: 0, total: 0 };
                }
                interestByGender[row.Gender].total++;
                if (row.Response === 1) {
                    interestByGender[row.Gender].interested++;
                }
            }
        });
        
        const genderData = [
            { index: 'Male', value: (interestByGender.Male?.interested / interestByGender.Male?.total) * 100 || 0 },
            { index: 'Female', value: (interestByGender.Female?.interested / interestByGender.Female?.total) * 100 || 0 }
        ];
        
        tfvis.render.barchart(
            { name: 'Interest Rate by Gender', tab: 'Charts' },
            genderData,
            { 
                xLabel: 'Gender', 
                yLabel: 'Interest Rate (%)',
                yAxisDomain: [0, 100]
            }
        );
        
        chartsDiv.innerHTML += `
            <div class="status success">
                <p><strong>Visualizations created successfully!</strong></p>
                <p>Using ${sampledData.length.toLocaleString()} sample records from ${trainData.length.toLocaleString()} total records.</p>
                <p>Click "Show Charts" button to view visualizations.</p>
            </div>
        `;
        
    } catch (error) {
        console.error('Error creating visualizations:', error);
        chartsDiv.innerHTML += `
            <div class="status error">
                <p><strong>Error creating charts:</strong> ${error.message}</p>
            </div>
        `;
    }
}

// Preprocess the data - ULTRA OPTIMIZED
async function preprocessData() {
    if (!trainData || !testData) {
        alert('Please load data first.');
        return;
    }
    
    const outputDiv = document.getElementById('preprocessing-output');
    outputDiv.innerHTML = `
        <div class="status">
            <p><strong>Preprocessing data... (This may take a minute)</strong></p>
            <p>Dataset size: Training: ${trainData.length.toLocaleString()}, Test: ${testData.length.toLocaleString()} samples</p>
            <div class="progress-bar">
                <div class="progress" id="preprocess-progress" style="width: 0%"></div>
            </div>
            <small id="progress-text">Initializing...</small>
        </div>
    `;
    
    console.log('Starting preprocessing for large dataset...');
    
    try {
        // Use data sampling for very large datasets
        const useSampling = document.getElementById('use-data-sampling').checked;
        let processedTrainData = trainData;
        
        if (useSampling && trainData.length > MAX_SAMPLES_FOR_TRAINING) {
            console.log(`Using sampling: ${MAX_SAMPLES_FOR_TRAINING} samples from ${trainData.length}`);
            processedTrainData = sampleData(trainData, MAX_SAMPLES_FOR_TRAINING);
            outputDiv.innerHTML += `<p><small>Using ${MAX_SAMPLES_FOR_TRAINING.toLocaleString()} sampled records for training (from ${trainData.length.toLocaleString()})</small></p>`;
        }
        
        updateProgress('Calculating basic statistics...', 5);
        
        // Calculate only essential statistics (much faster)
        const ageValues = processedTrainData.map(row => row.Age).filter(age => age !== null && !isNaN(age));
        const annualPremiumValues = processedTrainData.map(row => row.Annual_Premium).filter(premium => premium !== null && !isNaN(premium));
        
        const ageMedian = calculateMedian(ageValues);
        const annualPremiumMedian = calculateMedian(annualPremiumValues);
        
        console.log('Basic statistics calculated');
        
        // Preprocess training data with smaller batches
        updateProgress('Processing training data...', 10);
        const trainResult = await preprocessDatasetOptimized(processedTrainData, ageMedian, annualPremiumMedian, 'training');
        preprocessedTrainData = trainResult;
        
        // For test data, use same sampling ratio if training was sampled
        let processedTestData = testData;
        if (useSampling && testData.length > MAX_SAMPLES_FOR_TRAINING) {
            const testSampleSize = Math.min(MAX_SAMPLES_FOR_TRAINING, testData.length);
            processedTestData = testData.slice(0, testSampleSize);
        }
        
        // Preprocess test data
        updateProgress('Processing test data...', 60);
        const testResult = await preprocessDatasetOptimized(processedTestData, ageMedian, annualPremiumMedian, 'test');
        preprocessedTestData = testResult;
        
        updateProgress('Finalizing...', 90);
        
        console.log('Preprocessing completed successfully');
        
        outputDiv.innerHTML = `
            <div class="status success">
                <p><strong>Preprocessing completed successfully!</strong></p>
                <p>Training features shape: ${preprocessedTrainData.features.shape}</p>
                <p>Training labels shape: ${preprocessedTrainData.labels.shape}</p>
                <p>Test samples: ${preprocessedTestData.features.length}</p>
                ${useSampling ? 
                    `<p><small>Note: Used sampling for better performance</small></p>` : ''
                }
            </div>
        `;
        
        // Enable the create model button
        document.getElementById('create-model-btn').disabled = false;
        
    } catch (error) {
        console.error('Error during preprocessing:', error);
        outputDiv.innerHTML = `
            <div class="status error">
                <p><strong>Error during preprocessing:</strong></p>
                <p>${error.message}</p>
                <p>Try enabling "Use data sampling" for large datasets.</p>
            </div>
        `;
    }
}

// Ultra-optimized preprocessing
async function preprocessDatasetOptimized(data, ageMedian, annualPremiumMedian, datasetType) {
    const totalSamples = data.length;
    const features = new Array(totalSamples);
    const labels = datasetType === 'training' ? new Array(totalSamples) : null;
    const customerIds = datasetType === 'test' ? new Array(totalSamples) : null;
    
    let processed = 0;
    
    // Process in very small batches with regular yielding
    for (let i = 0; i < totalSamples; i++) {
        const row = data[i];
        
        // Ultra-simple feature extraction
        const featureVector = [
            // Numerical features with simple scaling
            ((row.Age || ageMedian) - ageMedian) / 50,
            ((row.Annual_Premium || annualPremiumMedian) - annualPremiumMedian) / 50000,
            (row.Region_Code || 0) / 100,
            (row.Policy_Sales_Channel || 0) / 200,
            (row.Vintage || 0) / 100,
            
            // Categorical as binary (much faster than one-hot)
            row.Gender === 'Male' ? 1 : 0,
            row.Gender === 'Female' ? 1 : 0,
            row.Driving_License === 1 ? 1 : 0,
            row.Previously_Insured === 1 ? 1 : 0,
            row.Vehicle_Age === '< 1 Year' ? 1 : 0,
            row.Vehicle_Age === '1-2 Year' ? 1 : 0, 
            row.Vehicle_Age === '> 2 Years' ? 1 : 0,
            row.Vehicle_Damage === 'Yes' ? 1 : 0
        ];
        
        features[i] = featureVector;
        
        if (datasetType === 'training') {
            labels[i] = row[TARGET_FEATURE];
        }
        
        if (datasetType === 'test') {
            customerIds[i] = row[ID_FEATURE];
        }
        
        processed++;
        
        // Update progress every 1000 samples
        if (processed % 1000 === 0) {
            const progress = datasetType === 'training' ? 
                10 + (processed / totalSamples) * 50 : 
                60 + (processed / totalSamples) * 30;
            
            updateProgress(`Processing ${datasetType} data: ${processed.toLocaleString()}/${totalSamples.toLocaleString()}`, progress);
            
            // Yield to UI to prevent freezing
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
    
    const result = { 
        features: tf.tensor2d(features),
        featureNames: ['Age', 'Premium', 'Region', 'Channel', 'Vintage', 'Male', 'Female', 'HasLicense', 'PreviouslyInsured', 'Vehicle<1', 'Vehicle1-2', 'Vehicle>2', 'HadDamage']
    };
    
    if (datasetType === 'training') {
        result.labels = tf.tensor1d(labels);
    }
    if (datasetType === 'test') {
        result.customerIds = customerIds;
    }
    
    return result;
}

// Simple data sampling
function sampleData(data, maxSamples) {
    if (data.length <= maxSamples) return data;
    
    // Simple random sampling (faster than stratified for very large datasets)
    const step = Math.ceil(data.length / maxSamples);
    const sampled = [];
    
    for (let i = 0; i < data.length && sampled.length < maxSamples; i += step) {
        sampled.push(data[i]);
    }
    
    return sampled;
}

// Helper functions
function calculateMedian(values) {
    if (!values || values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const half = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[half - 1] + sorted[half]) / 2 : sorted[half];
}

function updateProgress(text, percent) {
    const progressBar = document.getElementById('preprocess-progress');
    const progressText = document.getElementById('progress-text');
    if (progressBar) progressBar.style.width = Math.min(percent, 100) + '%';
    if (progressText) progressText.textContent = text;
}

// Create the model
function createModel() {
    if (!preprocessedTrainData) {
        alert('Please preprocess data first.');
        return;
    }
    
    const inputShape = preprocessedTrainData.features.shape[1];
    const modelType = document.getElementById('model-type').value;
    
    console.log('Creating model with input shape:', inputShape);
    
    // Create a simpler model for large datasets
    model = tf.sequential();
    
    // Always use simple model for large datasets
    model.add(tf.layers.dense({
        units: 8,
        activation: 'relu',
        inputShape: [inputShape]
    }));
    
    model.add(tf.layers.dense({
        units: 1,
        activation: 'sigmoid'
    }));
    
    // Compile with simpler optimizer
    model.compile({
        optimizer: 'adam',
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
    });
    
    // Display model summary
    const summaryDiv = document.getElementById('model-summary');
    summaryDiv.innerHTML = '<h3>Model Summary</h3>';
    
    let summaryText = `<p>Model Type: Simple Neural Network (optimized for large datasets)</p>`;
    summaryText += '<ul>';
    model.layers.forEach((layer, i) => {
        summaryText += `<li>Layer ${i+1}: ${layer.getClassName()} - Output Shape: ${JSON.stringify(layer.outputShape)}</li>`;
    });
    summaryText += '</ul>';
    summaryText += `<p>Total parameters: ${model.countParams().toLocaleString()}</p>`;
    summaryText += `<p>Input features: ${preprocessedTrainData.featureNames?.join(', ') || inputShape + ' features'}</p>`;
    summaryDiv.innerHTML += summaryText;
    
    // Enable the train button
    document.getElementById('train-btn').disabled = false;
}

// Train the model
async function trainModel() {
    if (!model || !preprocessedTrainData) {
        alert('Please create model first.');
        return;
    }
    
    const statusDiv = document.getElementById('training-status');
    statusDiv.innerHTML = 'Training model...';
    
    try {
        const epochs = parseInt(document.getElementById('epochs').value);
        
        // Use simpler training for large datasets
        trainingHistory = await model.fit(preprocessedTrainData.features, preprocessedTrainData.labels, {
            epochs: epochs,
            batchSize: 32,
            validationSplit: 0.2,
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    statusDiv.innerHTML = `Epoch ${epoch + 1}/${epochs} - loss: ${logs.loss.toFixed(4)}, acc: ${logs.acc.toFixed(4)}, val_loss: ${logs.val_loss.toFixed(4)}, val_acc: ${logs.val_acc.toFixed(4)}`;
                }
            }
        });
        
        statusDiv.innerHTML += '<p>Training completed!</p>';
        
        // Enable the predict button
        document.getElementById('predict-btn').disabled = false;
        
    } catch (error) {
        console.error('Error during training:', error);
        statusDiv.innerHTML = `Error during training: ${error.message}`;
    }
}

// Predict on test data
async function predict() {
    if (!model || !preprocessedTestData) {
        alert('Please train model first.');
        return;
    }
    
    const outputDiv = document.getElementById('prediction-output');
    outputDiv.innerHTML = 'Making predictions...';
    
    try {
        // Make predictions
        testPredictions = model.predict(preprocessedTestData.features);
        const predValues = await testPredictions.data();
        
        // Create prediction results
        const results = preprocessedTestData.customerIds.map((id, i) => ({
            CustomerId: id,
            Interested: predValues[i] >= 0.5 ? 1 : 0,
            Probability: predValues[i]
        }));
        
        // Show first 10 predictions
        outputDiv.innerHTML = '<h3>Prediction Results (First 10 Rows)</h3>';
        outputDiv.appendChild(createPredictionTable(results.slice(0, 10)));
        
        // Calculate summary statistics
        const interestedCount = results.filter(r => r.Interested === 1).length;
        const totalCount = results.length;
        const interestRate = (interestedCount / totalCount * 100).toFixed(2);
        
        outputDiv.innerHTML += `
            <div style="margin-top: 20px; padding: 15px; background-color: #e9f7ef; border-radius: 5px;">
                <h4>Prediction Summary</h4>
                <p>Total Customers: ${totalCount.toLocaleString()}</p>
                <p>Predicted Interested: ${interestedCount.toLocaleString()} (${interestRate}%)</p>
            </div>
        `;
        
        // Enable the export button
        document.getElementById('export-btn').disabled = false;
        
    } catch (error) {
        console.error('Error during prediction:', error);
        outputDiv.innerHTML = `Error during prediction: ${error.message}`;
    }
}

// Create prediction table
function createPredictionTable(data) {
    const table = document.createElement('table');
    table.className = 'data-table';
    
    // Create header row
    const headerRow = document.createElement('tr');
    ['Customer ID', 'Interested', 'Probability'].forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);
    
    // Create data rows
    data.forEach(row => {
        const tr = document.createElement('tr');
        
        // CustomerId
        const tdId = document.createElement('td');
        tdId.textContent = row.CustomerId;
        tr.appendChild(tdId);
        
        // Interested
        const tdInterested = document.createElement('td');
        tdInterested.textContent = row.Interested;
        tdInterested.style.color = row.Interested === 1 ? 'green' : 'red';
        tdInterested.style.fontWeight = 'bold';
        tr.appendChild(tdInterested);
        
        // Probability
        const tdProb = document.createElement('td');
        const prob = typeof row.Probability === 'number' ? row.Probability : parseFloat(row.Probability);
        tdProb.textContent = prob.toFixed(4);
        if (prob >= 0.7) tdProb.style.color = 'green';
        else if (prob >= 0.3) tdProb.style.color = 'orange';
        else tdProb.style.color = 'red';
        tr.appendChild(tdProb);
        
        table.appendChild(tr);
    });
    
    const container = document.createElement('div');
    container.className = 'table-container';
    container.appendChild(table);
    return container;
}

// Export results
async function exportResults() {
    if (!testPredictions || !preprocessedTestData) {
        alert('Please make predictions first.');
        return;
    }
    
    const statusDiv = document.getElementById('export-status');
    statusDiv.innerHTML = 'Exporting results...';
    
    try {
        const predValues = await testPredictions.data();
        
        // Create submission CSV
        let submissionCSV = 'id,Response\n';
        preprocessedTestData.customerIds.forEach((id, i) => {
            submissionCSV += `${id},${predValues[i] >= 0.5 ? 1 : 0}\n`;
        });
        
        // Create download link
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([submissionCSV], { type: 'text/csv' }));
        link.download = 'insurance_predictions.csv';
        link.click();
        
        statusDiv.innerHTML = `
            <div class="status success">
                <p><strong>Export completed!</strong></p>
                <p>Downloaded: insurance_predictions.csv</p>
            </div>
        `;
        
    } catch (error) {
        console.error('Error during export:', error);
        statusDiv.innerHTML = `<div class="status error">Error during export: ${error.message}</div>`;
    }
}

// Fixed toggleVisor function (no getTabs)
function toggleVisor() {
    const button = document.getElementById('visor-toggle-btn');
    
    if (!trainData) {
        alert('Charts are not loaded yet. Please click "Inspect Data" first.');
        return;
    }
    
    const visorInstance = tfvis.visor();
    
    if (visorInstance.isOpen()) {
        visorInstance.close();
        button.innerHTML = '<span class="icon">📊</span> Show Charts';
        button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    } else {
        visorInstance.open();
        button.innerHTML = '<span class="icon">📊</span> Hide Charts';
        button.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    if (tfvis.visor().isOpen()) {
        tfvis.visor().close();
    }
    console.log('Health Insurance Prediction App initialized');
});