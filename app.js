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
        
        statusDiv.innerHTML = `Data loaded successfully! Training: ${trainData.length} samples, Test: ${testData.length} samples`;
        
        // Enable the inspect button
        document.getElementById('inspect-btn').disabled = false;
        
        // Update step indicator
        updateStepIndicator(2);
    } catch (error) {
        console.error('Error loading data:', error);
        statusDiv.innerHTML = `Error loading data: ${error.message}`;
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
            // Handle missing values (empty strings)
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
    
    // Push the last field
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
    
    const shapeInfo = `Dataset shape: ${trainData.length} rows x ${Object.keys(trainData[0]).length} columns`;
    const interestCount = trainData.filter(row => row[TARGET_FEATURE] === 1).length;
    const interestRate = (interestCount / trainData.length * 100).toFixed(2);
    const targetInfo = `Interest rate: ${interestCount}/${trainData.length} (${interestRate}%)`;
    
    // Calculate missing values percentage for each feature
    let missingInfo = '<h4>Missing Values Percentage:</h4><ul>';
    Object.keys(trainData[0]).forEach(feature => {
        const missingCount = trainData.filter(row => 
            row[feature] === null || row[feature] === undefined || row[feature] === ''
        ).length;
        const missingPercent = (missingCount / trainData.length * 100).toFixed(2);
        missingInfo += `<li>${feature}: ${missingPercent}%</li>`;
    });
    missingInfo += '</ul>';
    
    statsDiv.innerHTML += `<p>${shapeInfo}</p><p>${targetInfo}</p>${missingInfo}`;
    
    // Create visualizations
    createVisualizations();
    
    // Enable the preprocess button
    document.getElementById('preprocess-btn').disabled = false;
    
    // Update step indicator
    updateStepIndicator(3);
}

// Create a preview table from data
function createPreviewTable(data) {
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.overflowX = 'auto';
    table.style.display = 'block';
    
    // Create header row
    const headerRow = document.createElement('tr');
    headerRow.style.backgroundColor = '#f8f9fa';
    Object.keys(data[0]).forEach(key => {
        const th = document.createElement('th');
        th.textContent = key;
        th.style.padding = '12px 8px';
        th.style.border = '1px solid #dee2e6';
        th.style.textAlign = 'left';
        th.style.fontWeight = '600';
        th.style.whiteSpace = 'nowrap';
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);
    
    // Create data rows
    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #dee2e6';
        
        Object.values(row).forEach((value, index) => {
            const td = document.createElement('td');
            td.textContent = value !== null ? value : 'NULL';
            td.style.padding = '10px 8px';
            td.style.border = '1px solid #dee2e6';
            td.style.maxWidth = '200px';
            td.style.overflow = 'hidden';
            td.style.textOverflow = 'ellipsis';
            td.style.whiteSpace = 'nowrap';
            
            // Add some color coding for better readability
            if (index === 0) {
                td.style.backgroundColor = '#f8f9fa';
                td.style.fontWeight = '500';
            }
            
            tr.appendChild(td);
        });
        table.appendChild(tr);
    });
    
    // Create a container for horizontal scrolling
    const tableContainer = document.createElement('div');
    tableContainer.style.overflowX = 'auto';
    tableContainer.style.width = '100%';
    tableContainer.style.border = '1px solid #dee2e6';
    tableContainer.style.borderRadius = '8px';
    tableContainer.style.marginTop = '15px';
    tableContainer.appendChild(table);
    
    return tableContainer;
}

// Create visualizations using tfjs-vis
function createVisualizations() {
    console.log('Creating visualizations...');
    const chartsDiv = document.getElementById('charts');
    chartsDiv.innerHTML = '<h3>Data Visualizations</h3>';
    
    try {
        // Interest by Gender
        const interestByGender = {};
        trainData.forEach(row => {
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
        
        // Interest by Vehicle Age
        const interestByVehicleAge = {};
        trainData.forEach(row => {
            if (row.Vehicle_Age !== undefined && row.Vehicle_Age !== null && row.Response !== undefined && row.Response !== null) {
                if (!interestByVehicleAge[row.Vehicle_Age]) {
                    interestByVehicleAge[row.Vehicle_Age] = { interested: 0, total: 0 };
                }
                interestByVehicleAge[row.Vehicle_Age].total++;
                if (row.Response === 1) {
                    interestByVehicleAge[row.Vehicle_Age].interested++;
                }
            }
        });
        
        const vehicleAgeData = Object.keys(interestByVehicleAge).map(age => ({
            index: age,
            value: (interestByVehicleAge[age].interested / interestByVehicleAge[age].total) * 100
        }));
        
        tfvis.render.barchart(
            { name: 'Interest Rate by Vehicle Age', tab: 'Charts' },
            vehicleAgeData,
            { 
                xLabel: 'Vehicle Age', 
                yLabel: 'Interest Rate (%)',
                yAxisDomain: [0, 100]
            }
        );
        
        chartsDiv.innerHTML += '<p>Charts are displayed in the tfjs-vis visor. Click the "Show Charts" button to view.</p>';
        
    } catch (error) {
        console.error('Error creating visualizations:', error);
        chartsDiv.innerHTML += `<p style="color: red;">Error creating charts: ${error.message}</p>`;
    }
}

// Preprocess the data
function preprocessData() {
    if (!trainData || !testData) {
        alert('Please load data first.');
        return;
    }
    
    const outputDiv = document.getElementById('preprocessing-output');
    outputDiv.innerHTML = 'Preprocessing data...<br><small>This may take a moment for large datasets</small>';
    
    console.log('Starting preprocessing...');
    console.log('Train data length:', trainData.length);
    console.log('Test data length:', testData.length);
    
    // Use setTimeout to allow UI to update
    setTimeout(() => {
        try {
            // Calculate imputation values from training data
            console.log('Calculating imputation values...');
            
            const ageValues = trainData.map(row => row.Age).filter(age => age !== null && !isNaN(age));
            const annualPremiumValues = trainData.map(row => row.Annual_Premium).filter(premium => premium !== null && !isNaN(premium));
            const regionCodeValues = trainData.map(row => row.Region_Code).filter(code => code !== null && !isNaN(code));
            const policyChannelValues = trainData.map(row => row.Policy_Sales_Channel).filter(channel => channel !== null && !isNaN(channel));
            
            const ageMedian = calculateMedian(ageValues);
            const annualPremiumMedian = calculateMedian(annualPremiumValues);
            const regionCodeMedian = calculateMedian(regionCodeValues);
            const policyChannelMedian = calculateMedian(policyChannelValues);
            
            console.log('Imputation values calculated:', {
                ageMedian, annualPremiumMedian, regionCodeMedian, policyChannelMedian
            });
            
            // Preprocess training data
            console.log('Preprocessing training data...');
            preprocessedTrainData = {
                features: [],
                labels: []
            };
            
            const batchSize = 1000;
            for (let i = 0; i < trainData.length; i += batchSize) {
                const batch = trainData.slice(i, i + batchSize);
                batch.forEach(row => {
                    const features = extractFeatures(row, ageMedian, annualPremiumMedian, regionCodeMedian, policyChannelMedian);
                    preprocessedTrainData.features.push(features);
                    preprocessedTrainData.labels.push(row[TARGET_FEATURE]);
                });
                
                // Update progress
                if (i % 5000 === 0) {
                    outputDiv.innerHTML = `Preprocessing training data... ${Math.min(i + batchSize, trainData.length)}/${trainData.length} samples`;
                    console.log(`Processed ${Math.min(i + batchSize, trainData.length)}/${trainData.length} training samples`);
                }
            }
            
            // Preprocess test data
            console.log('Preprocessing test data...');
            preprocessedTestData = {
                features: [],
                customerIds: []
            };
            
            for (let i = 0; i < testData.length; i += batchSize) {
                const batch = testData.slice(i, i + batchSize);
                batch.forEach(row => {
                    const features = extractFeatures(row, ageMedian, annualPremiumMedian, regionCodeMedian, policyChannelMedian);
                    preprocessedTestData.features.push(features);
                    preprocessedTestData.customerIds.push(row[ID_FEATURE]);
                });
                
                // Update progress
                if (i % 5000 === 0) {
                    outputDiv.innerHTML = `Preprocessing test data... ${Math.min(i + batchSize, testData.length)}/${testData.length} samples`;
                    console.log(`Processed ${Math.min(i + batchSize, testData.length)}/${testData.length} test samples`);
                }
            }
            
            console.log('Converting to tensors...');
            // Convert to tensors - use CPU backend to avoid WebGL issues
            tf.setBackend('cpu');
            
            preprocessedTrainData.features = tf.tensor2d(preprocessedTrainData.features);
            preprocessedTrainData.labels = tf.tensor1d(preprocessedTrainData.labels);
            
            console.log('Preprocessing completed successfully');
            console.log('Training features shape:', preprocessedTrainData.features.shape);
            console.log('Test features count:', preprocessedTestData.features.length);
            
            outputDiv.innerHTML = `
                <div style="color: green;">
                    <p><strong>Preprocessing completed!</strong></p>
                    <p>Training features shape: ${preprocessedTrainData.features.shape}</p>
                    <p>Training labels shape: ${preprocessedTrainData.labels.shape}</p>
                    <p>Test features shape: [${preprocessedTestData.features.length}, ${preprocessedTestData.features[0] ? preprocessedTestData.features[0].length : 0}]</p>
                </div>
            `;
            
            // Enable the create model button
            document.getElementById('create-model-btn').disabled = false;
            
            // Update step indicator
            updateStepIndicator(4);
            
        } catch (error) {
            console.error('Error during preprocessing:', error);
            outputDiv.innerHTML = `<div style="color: red;">
                <p><strong>Error during preprocessing:</strong></p>
                <p>${error.message}</p>
                <p>Check console for details</p>
            </div>`;
        }
    }, 100);
}

// Extract features from a row with imputation and normalization
function extractFeatures(row, ageMedian, annualPremiumMedian, regionCodeMedian, policyChannelMedian) {
    // Safe imputation with null checks
    const age = (row.Age !== null && !isNaN(row.Age)) ? row.Age : ageMedian;
    const annualPremium = (row.Annual_Premium !== null && !isNaN(row.Annual_Premium)) ? row.Annual_Premium : annualPremiumMedian;
    const regionCode = (row.Region_Code !== null && !isNaN(row.Region_Code)) ? row.Region_Code : regionCodeMedian;
    const policyChannel = (row.Policy_Sales_Channel !== null && !isNaN(row.Policy_Sales_Channel)) ? row.Policy_Sales_Channel : policyChannelMedian;
    const vintage = (row.Vintage !== null && !isNaN(row.Vintage)) ? row.Vintage : 0;
    
    // Get training data for standardization
    const trainAges = trainData.map(r => r.Age).filter(a => a !== null && !isNaN(a));
    const trainPremiums = trainData.map(r => r.Annual_Premium).filter(p => p !== null && !isNaN(p));
    const trainRegions = trainData.map(r => r.Region_Code).filter(c => c !== null && !isNaN(c));
    const trainChannels = trainData.map(r => r.Policy_Sales_Channel).filter(c => c !== null && !isNaN(c));
    const trainVintages = trainData.map(r => r.Vintage).filter(v => v !== null && !isNaN(v));
    
    // Safe standardization with fallback
    const standardizedAge = (age - ageMedian) / (calculateStdDev(trainAges) || 1);
    const standardizedPremium = (annualPremium - annualPremiumMedian) / (calculateStdDev(trainPremiums) || 1);
    const standardizedRegion = (regionCode - regionCodeMedian) / (calculateStdDev(trainRegions) || 1);
    const standardizedChannel = (policyChannel - policyChannelMedian) / (calculateStdDev(trainChannels) || 1);
    const standardizedVintage = (vintage - calculateMean(trainVintages)) / (calculateStdDev(trainVintages) || 1);
    
    // Safe one-hot encoding with fallbacks
    const genderOneHot = oneHotEncode(row.Gender, ['Male', 'Female']);
    const drivingLicenseOneHot = oneHotEncode(row.Driving_License?.toString(), ['0', '1']);
    const previouslyInsuredOneHot = oneHotEncode(row.Previously_Insured?.toString(), ['0', '1']);
    const vehicleAgeOneHot = oneHotEncode(row.Vehicle_Age, ['< 1 Year', '1-2 Year', '> 2 Years']);
    const vehicleDamageOneHot = oneHotEncode(row.Vehicle_Damage, ['Yes', 'No']);
    
    // Start with numerical features
    let features = [
        isNaN(standardizedAge) ? 0 : standardizedAge,
        isNaN(standardizedPremium) ? 0 : standardizedPremium,
        isNaN(standardizedRegion) ? 0 : standardizedRegion,
        isNaN(standardizedChannel) ? 0 : standardizedChannel,
        isNaN(standardizedVintage) ? 0 : standardizedVintage
    ];
    
    // Add one-hot encoded features
    features = features.concat(
        genderOneHot, 
        drivingLicenseOneHot, 
        previouslyInsuredOneHot, 
        vehicleAgeOneHot, 
        vehicleDamageOneHot
    );
    
    // Add interaction features if enabled
    if (document.getElementById('add-interaction-features').checked) {
        const agePremiumInteraction = age * annualPremium / 1000000;
        const premiumDamageInteraction = annualPremium * (row.Vehicle_Damage === 'Yes' ? 1 : 0);
        features.push(
            isNaN(agePremiumInteraction) ? 0 : agePremiumInteraction,
            isNaN(premiumDamageInteraction) ? 0 : premiumDamageInteraction
        );
    }
    
    return features;
}

// Calculate median of an array
function calculateMedian(values) {
    if (!values || values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const half = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
        return (sorted[half - 1] + sorted[half]) / 2;
    }
    
    return sorted[half];
}

// Calculate mean of an array
function calculateMean(values) {
    if (!values || values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
}

// Calculate standard deviation of an array
function calculateStdDev(values) {
    if (!values || values.length === 0) return 1;
    
    const mean = calculateMean(values);
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(variance);
}

// One-hot encode a value
function oneHotEncode(value, categories) {
    if (!categories || categories.length === 0) return [];
    
    const encoding = new Array(categories.length).fill(0);
    const index = categories.indexOf(value);
    if (index !== -1) {
        encoding[index] = 1;
    }
    return encoding;
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
    
    // Create model based on selection
    model = tf.sequential();
    
    if (modelType === 'simple') {
        // Simple model for baseline
        model.add(tf.layers.dense({
            units: 8,
            activation: 'relu',
            inputShape: [inputShape]
        }));
        
        model.add(tf.layers.dense({
            units: 1,
            activation: 'sigmoid'
        }));
    } else if (modelType === 'deep') {
        // Deeper model for better performance
        model.add(tf.layers.dense({
            units: 32,
            activation: 'relu',
            inputShape: [inputShape]
        }));
        
        model.add(tf.layers.dropout({ rate: 0.3 }));
        
        model.add(tf.layers.dense({
            units: 16,
            activation: 'relu'
        }));
        
        model.add(tf.layers.dropout({ rate: 0.2 }));
        
        model.add(tf.layers.dense({
            units: 1,
            activation: 'sigmoid'
        }));
    }
    
    // Compile the model with custom metrics
    model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy'] // We'll calculate precision and recall manually
    });
    
    // Display model summary
    const summaryDiv = document.getElementById('model-summary');
    summaryDiv.innerHTML = '<h3>Model Summary</h3>';
    
    let summaryText = `<p>Model Type: ${modelType === 'simple' ? 'Simple Neural Network' : 'Deep Neural Network'}</p>`;
    summaryText += '<ul>';
    model.layers.forEach((layer, i) => {
        summaryText += `<li>Layer ${i+1}: ${layer.getClassName()} - Output Shape: ${JSON.stringify(layer.outputShape)}</li>`;
    });
    summaryText += '</ul>';
    summaryText += `<p>Total parameters: ${model.countParams()}</p>`;
    summaryDiv.innerHTML += summaryText;
    
    // Enable the train button
    document.getElementById('train-btn').disabled = false;
    
    // Update step indicator
    updateStepIndicator(5);
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
        // Split training data into train and validation sets (80/20)
        const splitIndex = Math.floor(preprocessedTrainData.features.shape[0] * 0.8);
        
        const trainFeatures = preprocessedTrainData.features.slice(0, splitIndex);
        const trainLabels = preprocessedTrainData.labels.slice(0, splitIndex);
        
        const valFeatures = preprocessedTrainData.features.slice(splitIndex);
        const valLabels = preprocessedTrainData.labels.slice(splitIndex);
        
        // Store validation data for later evaluation
        validationData = valFeatures;
        validationLabels = valLabels;
        
        const epochs = parseInt(document.getElementById('epochs').value);
        
        // Train the model
        trainingHistory = await model.fit(trainFeatures, trainLabels, {
            epochs: epochs,
            batchSize: 32,
            validationData: [valFeatures, valLabels],
            callbacks: tfvis.show.fitCallbacks(
                { name: 'Training Performance' },
                ['loss', 'acc', 'val_loss', 'val_acc'],
                { 
                    callbacks: ['onEpochEnd'],
                    onEpochEnd: (epoch, logs) => {
                        statusDiv.innerHTML = `Epoch ${epoch + 1}/${epochs} - loss: ${logs.loss.toFixed(4)}, acc: ${logs.acc.toFixed(4)}, val_loss: ${logs.val_loss.toFixed(4)}, val_acc: ${logs.val_acc.toFixed(4)}`;
                    }
                }
            )
        });
        
        statusDiv.innerHTML += '<p>Training completed!</p>';
        
        // Make predictions on validation set for evaluation
        validationPredictions = model.predict(validationData);
        
        // Enable the threshold slider and evaluation
        document.getElementById('threshold-slider').disabled = false;
        document.getElementById('threshold-slider').addEventListener('input', updateMetrics);
        
        // Enable the predict button
        document.getElementById('predict-btn').disabled = false;
        
        // Calculate initial metrics
        updateMetrics();
        
    } catch (error) {
        console.error('Error during training:', error);
        statusDiv.innerHTML = `Error during training: ${error.message}`;
    }
}

// Update metrics based on threshold
async function updateMetrics() {
    if (!validationPredictions || !validationLabels) return;
    
    const threshold = parseFloat(document.getElementById('threshold-slider').value);
    document.getElementById('threshold-value').textContent = threshold.toFixed(2);
    
    try {
        // Calculate confusion matrix
        const predVals = await validationPredictions.array();
        const trueVals = await validationLabels.array();
        
        let tp = 0, tn = 0, fp = 0, fn = 0;
        
        for (let i = 0; i < predVals.length; i++) {
            const prediction = predVals[i] >= threshold ? 1 : 0;
            const actual = trueVals[i];
            
            if (prediction === 1 && actual === 1) tp++;
            else if (prediction === 0 && actual === 0) tn++;
            else if (prediction === 1 && actual === 0) fp++;
            else if (prediction === 0 && actual === 1) fn++;
        }
        
        // Update confusion matrix display
        const cmDiv = document.getElementById('confusion-matrix');
        cmDiv.innerHTML = `
            <div style="overflow-x: auto;">
                <table style="border-collapse: collapse; width: 100%; min-width: 300px;">
                    <tr>
                        <th style="border: 1px solid #ddd; padding: 12px;"></th>
                        <th style="border: 1px solid #ddd; padding: 12px;">Predicted Interested</th>
                        <th style="border: 1px solid #ddd; padding: 12px;">Predicted Not Interested</th>
                    </tr>
                    <tr>
                        <th style="border: 1px solid #ddd; padding: 12px;">Actual Interested</th>
                        <td style="border: 1px solid #ddd; padding: 12px; text-align: center; background-color: #d4edda;">${tp}</td>
                        <td style="border: 1px solid #ddd; padding: 12px; text-align: center; background-color: #f8d7da;">${fn}</td>
                    </tr>
                    <tr>
                        <th style="border: 1px solid #ddd; padding: 12px;">Actual Not Interested</th>
                        <td style="border: 1px solid #ddd; padding: 12px; text-align: center; background-color: #f8d7da;">${fp}</td>
                        <td style="border: 1px solid #ddd; padding: 12px; text-align: center; background-color: #d4edda;">${tn}</td>
                    </tr>
                </table>
            </div>
        `;
        
        // Calculate performance metrics including recall
        const precision = tp / (tp + fp) || 0;
        const recall = tp / (tp + fn) || 0; // This is the recall metric you wanted
        const f1 = 2 * (precision * recall) / (precision + recall) || 0;
        const accuracy = (tp + tn) / (tp + tn + fp + fn) || 0;
        
        // Update performance metrics display
        const metricsDiv = document.getElementById('performance-metrics');
        metricsDiv.innerHTML = `
            <div style="font-size: 14px;">
                <p><strong>Accuracy:</strong> ${(accuracy * 100).toFixed(2)}%</p>
                <p><strong>Precision:</strong> ${precision.toFixed(4)}</p>
                <p><strong>Recall:</strong> ${recall.toFixed(4)}</p>
                <p><strong>F1 Score:</strong> ${f1.toFixed(4)}</p>
            </div>
        `;
        
        // Calculate and plot ROC curve
        await plotROC(trueVals, predVals);
        
    } catch (error) {
        console.error('Error updating metrics:', error);
    }
}

// Plot ROC curve
async function plotROC(trueLabels, predictions) {
    try {
        // Calculate TPR and FPR for different thresholds
        const thresholds = Array.from({ length: 50 }, (_, i) => i / 50);
        const rocData = [];
        
        thresholds.forEach(threshold => {
            let tp = 0, fn = 0, fp = 0, tn = 0;
            
            for (let i = 0; i < predictions.length; i++) {
                const prediction = predictions[i] >= threshold ? 1 : 0;
                const actual = trueLabels[i];
                
                if (actual === 1) {
                    if (prediction === 1) tp++;
                    else fn++;
                } else {
                    if (prediction === 1) fp++;
                    else tn++;
                }
            }
            
            const tpr = tp / (tp + fn) || 0;
            const fpr = fp / (fp + tn) || 0;
            
            rocData.push({ threshold, fpr, tpr });
        });
        
        // Calculate AUC (approximate using trapezoidal rule)
        let auc = 0;
        for (let i = 1; i < rocData.length; i++) {
            auc += (rocData[i].fpr - rocData[i-1].fpr) * (rocData[i].tpr + rocData[i-1].tpr) / 2;
        }
        
        // Plot ROC curve
        tfvis.render.linechart(
            { name: 'ROC Curve', tab: 'Evaluation' },
            { values: rocData.map(d => ({ x: d.fpr, y: d.tpr })) },
            { 
                xLabel: 'False Positive Rate', 
                yLabel: 'True Positive Rate',
                series: ['ROC Curve'],
                width: 400,
                height: 400
            }
        );
        
        // Add AUC to performance metrics
        const metricsDiv = document.getElementById('performance-metrics');
        metricsDiv.innerHTML += `<p><strong>AUC:</strong> ${auc.toFixed(4)}</p>`;
        
    } catch (error) {
        console.error('Error plotting ROC curve:', error);
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
        // Convert test features to tensor
        const testFeatures = tf.tensor2d(preprocessedTestData.features);
        
        // Make predictions
        testPredictions = model.predict(testFeatures);
        
        // Extract prediction values
        const predValues = await testPredictions.data();
        
        // Create prediction results
        const threshold = parseFloat(document.getElementById('threshold-slider').value);
        const results = preprocessedTestData.customerIds.map((id, i) => ({
            CustomerId: id,
            Interested: predValues[i] >= threshold ? 1 : 0,
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
                <p>Total Customers: ${totalCount}</p>
                <p>Predicted Interested: ${interestedCount} (${interestRate}%)</p>
                <p>Threshold: ${threshold.toFixed(2)}</p>
            </div>
        `;
        
        // Enable the export button
        document.getElementById('export-btn').disabled = false;
        
        // Update step indicator
        updateStepIndicator(6);
        
    } catch (error) {
        console.error('Error during prediction:', error);
        outputDiv.innerHTML = `Error during prediction: ${error.message}`;
    }
}

// Create prediction table
function createPredictionTable(data) {
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    
    // Create header row
    const headerRow = document.createElement('tr');
    headerRow.style.backgroundColor = '#f8f9fa';
    ['Customer ID', 'Interested', 'Probability'].forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        th.style.padding = '12px 8px';
        th.style.border = '1px solid #dee2e6';
        th.style.textAlign = 'left';
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);
    
    // Create data rows
    data.forEach(row => {
        const tr = document.createElement('tr');
        
        // CustomerId
        const tdId = document.createElement('td');
        tdId.textContent = row.CustomerId;
        tdId.style.padding = '10px 8px';
        tdId.style.border = '1px solid #dee2e6';
        tr.appendChild(tdId);
        
        // Interested
        const tdInterested = document.createElement('td');
        tdInterested.textContent = row.Interested;
        tdInterested.style.padding = '10px 8px';
        tdInterested.style.border = '1px solid #dee2e6';
        tdInterested.style.color = row.Interested === 1 ? 'green' : 'red';
        tdInterested.style.fontWeight = 'bold';
        tr.appendChild(tdInterested);
        
        // Probability
        const tdProb = document.createElement('td');
        const prob = typeof row.Probability === 'number' ? row.Probability : parseFloat(row.Probability);
        tdProb.textContent = prob.toFixed(4);
        tdProb.style.padding = '10px 8px';
        tdProb.style.border = '1px solid #dee2e6';
        tr.appendChild(tdProb);
        
        table.appendChild(tr);
    });
    
    // Create a container for horizontal scrolling
    const tableContainer = document.createElement('div');
    tableContainer.style.overflowX = 'auto';
    tableContainer.style.width = '100%';
    tableContainer.style.border = '1px solid #dee2e6';
    tableContainer.style.borderRadius = '8px';
    tableContainer.style.marginTop = '15px';
    tableContainer.appendChild(table);
    
    return tableContainer;
}

// Export predictions to CSV
function exportPredictions() {
    if (!testPredictions || !preprocessedTestData) {
        alert('Please make predictions first.');
        return;
    }
    
    try {
        // Get predictions
        const predValues = testPredictions.arraySync();
        const threshold = parseFloat(document.getElementById('threshold-slider').value);
        
        // Create CSV content
        let csvContent = 'CustomerId,Interested,Probability\n';
        
        preprocessedTestData.customerIds.forEach((id, i) => {
            const interested = predValues[i] >= threshold ? 1 : 0;
            const probability = predValues[i];
            csvContent += `${id},${interested},${probability}\n`;
        });
        
        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'health_insurance_predictions.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('Predictions exported successfully!');
        
    } catch (error) {
        console.error('Error exporting predictions:', error);
        alert('Error exporting predictions: ' + error.message);
    }
}

// Toggle visor function - FIXED VERSION
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
        recreateVisualizations();
        button.innerHTML = '<span class="icon">📊</span> Hide Charts';
        button.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
    }
}

// Recreate visualizations - FIXED VERSION
function recreateVisualizations() {
    if (!trainData) return;
    
    try {
        // Clear existing tabs by recreating the surface
        const surfaces = tfvis.visor().surfaces;
        Object.keys(surfaces).forEach(key => {
            if (surfaces[key].surface) {
                surfaces[key].surface.dispose();
            }
        });
        
        // Recreate visualizations
        createVisualizations();
    } catch (error) {
        console.error('Error recreating visualizations:', error);
        // If the above fails, just create new visualizations
        createVisualizations();
    }
}

// Update step indicator
function updateStepIndicator(stepNumber) {
    // Reset all steps
    for (let i = 1; i <= 6; i++) {
        const step = document.getElementById(`step${i}`);
        step.classList.remove('active', 'completed');
    }
    
    // Mark previous steps as completed and current as active
    for (let i = 1; i <= 6; i++) {
        const step = document.getElementById(`step${i}`);
        if (i < stepNumber) {
            step.classList.add('completed');
        } else if (i === stepNumber) {
            step.classList.add('active');
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Close visor on page load
    if (tfvis.visor().isOpen()) {
        tfvis.visor().close();
    }
    
    // Set CPU backend to avoid WebGL issues
    tf.setBackend('cpu');
    
    console.log('Health Insurance Prediction App initialized');
    
    // Initialize step indicator
    updateStepIndicator(1);
});