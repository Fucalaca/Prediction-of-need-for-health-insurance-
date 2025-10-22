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

// Application modes
const APP_MODE = {
    TRAINING: 'training',
    PREDICTION: 'prediction'
};

let currentMode = APP_MODE.TRAINING;
let trainedModel = null;

// Switch between ML Specialist and Business User modes
function switchMode(mode) {
    currentMode = mode;
    
    // Hide all cards first
    document.querySelectorAll('.card').forEach(card => {
        card.style.display = 'none';
    });
    
    if (mode === APP_MODE.TRAINING) {
        // Show ML Specialist sections
        const mlSections = [
            'Data Upload', 'Data Exploration', 'Data Preprocessing', 
            'Model Configuration', 'Model Training', 'Model Evaluation',
            'Prediction', 'Export Results'
        ];
        
        document.querySelectorAll('.card').forEach(card => {
            const cardTitle = card.querySelector('h2');
            if (cardTitle) {
                const titleText = cardTitle.textContent || cardTitle.innerText;
                if (mlSections.some(section => titleText.includes(section))) {
                    card.style.display = 'block';
                }
            }
        });
        
        document.getElementById('ml-mode-btn').style.background = 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)';
        document.getElementById('business-mode-btn').style.background = '#6c757d';
        document.getElementById('mode-indicator').textContent = 'Current Mode: ML Specialist';
        document.getElementById('mode-indicator').style.color = '#007bff';
    } else {
        // Business User Mode - show only relevant sections
        const businessSections = [
            'Business Insights', 'Single Customer Prediction', 'Business Prediction'
        ];
        
        document.querySelectorAll('.card').forEach(card => {
            const cardTitle = card.querySelector('h2');
            if (cardTitle) {
                const titleText = cardTitle.textContent || cardTitle.innerText;
                if (businessSections.some(section => titleText.includes(section))) {
                    card.style.display = 'block';
                }
            }
        });
        
        document.getElementById('ml-mode-btn').style.background = '#6c757d';
        document.getElementById('business-mode-btn').style.background = 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)';
        document.getElementById('mode-indicator').textContent = 'Current Mode: Business User';
        document.getElementById('mode-indicator').style.color = '#28a745';
        
        if (!trainedModel) {
            alert('No trained model available. Please train the model in ML Specialist mode first.');
            switchMode(APP_MODE.TRAINING);
            return;
        }
        
        // Generate business insights if data is available
        if (trainData) {
            generateBusinessInsights();
            createBusinessVisualizations();
        }
    }
    updateModelStatus();
}

// Load data from uploaded CSV files
async function loadData() {
    const trainFile = document.getElementById('train-file').files[0];
    const testFile = document.getElementById('test-file').files[0];
    
    if (!trainFile) {
        alert('Please upload at least training CSV file.');
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
        
        // Load test data if provided
        if (testFile) {
            const testText = await readFile(testFile);
            testData = parseCSV(testText);
            console.log('Test data loaded:', testData.length, 'rows');
        }
        
        statusDiv.innerHTML = `Data loaded successfully! Training: ${trainData.length} samples${testData ? `, Test: ${testData.length} samples` : ''}`;
        
        // Enable the inspect button
        document.getElementById('inspect-btn').disabled = false;
        
        // If in business mode, update insights
        if (currentMode === APP_MODE.PREDICTION) {
            generateBusinessInsights();
            createBusinessVisualizations();
        }
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
    
    statsDiv.innerHTML += `<p>${shapeInfo}</p><p>${targetInfo}</p>`;
    
    // Enable the preprocess button
    document.getElementById('preprocess-btn').disabled = false;
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

// Enhanced Business Insights for Business Mode
function generateBusinessInsights() {
    if (!trainData || trainData.length === 0) {
        console.log('No data available for business insights');
        return;
    }
    
    const insightsDiv = document.getElementById('business-insights');
    if (!insightsDiv) {
        console.error('Business insights div not found');
        return;
    }
    
    insightsDiv.innerHTML = '<h3>📊 Business Insights & Customer Analysis</h3>';
    
    // Calculate insights
    const totalCustomers = trainData.length;
    const interestedCustomers = trainData.filter(row => row.Response === 1).length;
    const overallInterestRate = (interestedCustomers / totalCustomers * 100).toFixed(1);
    
    // Age analysis
    const ages = trainData.map(row => row.Age).filter(age => age !== null && !isNaN(age));
    const avgAge = calculateMean(ages);
    const youngCustomers = trainData.filter(row => row.Age < 30).length;
    const youngInterestRate = youngCustomers > 0 ? 
        (trainData.filter(row => row.Age < 30 && row.Response === 1).length / youngCustomers * 100).toFixed(1) : 0;
    
    // Premium analysis
    const premiums = trainData.map(row => row.Annual_Premium).filter(p => p !== null && !isNaN(p));
    const avgPremium = calculateMean(premiums);
    const highPremiumCustomers = trainData.filter(row => row.Annual_Premium > 50000).length;
    
    // Vehicle Damage analysis
    const damageData = {};
    trainData.forEach(row => {
        if (row.Vehicle_Damage && row.Response !== undefined && row.Response !== null) {
            if (!damageData[row.Vehicle_Damage]) {
                damageData[row.Vehicle_Damage] = { interested: 0, total: 0 };
            }
            damageData[row.Vehicle_Damage].total++;
            if (row.Response === 1) damageData[row.Vehicle_Damage].interested++;
        }
    });
    
    // Gender analysis
    const genderData = {};
    trainData.forEach(row => {
        if (row.Gender && row.Response !== undefined && row.Response !== null) {
            if (!genderData[row.Gender]) {
                genderData[row.Gender] = { interested: 0, total: 0 };
            }
            genderData[row.Gender].total++;
            if (row.Response === 1) genderData[row.Gender].interested++;
        }
    });
    
    insightsDiv.innerHTML += `
        <div class="insight-card">
            <h4>🎯 Customer Portfolio Overview</h4>
            <div class="metric-grid">
                <div class="metric">
                    <span class="metric-value">${totalCustomers.toLocaleString()}</span>
                    <span class="metric-label">Total Customers</span>
                </div>
                <div class="metric">
                    <span class="metric-value">${overallInterestRate}%</span>
                    <span class="metric-label">Interest Rate</span>
                </div>
                <div class="metric">
                    <span class="metric-value">${interestedCustomers}</span>
                    <span class="metric-label">Interested Customers</span>
                </div>
                <div class="metric">
                    <span class="metric-value">₹${avgPremium.toFixed(0)}</span>
                    <span class="metric-label">Avg Premium</span>
                </div>
            </div>
        </div>
        
        <div class="insight-card">
            <h4>📈 Demographic Insights</h4>
            <p><strong>Average Customer Age:</strong> ${avgAge.toFixed(1)} years</p>
            <p><strong>Young Customers (<30):</strong> ${youngCustomers} (${(youngCustomers/totalCustomers*100).toFixed(1)}% of portfolio)</p>
            <p><strong>Young Customer Interest Rate:</strong> ${youngInterestRate}%</p>
            <p><strong>High-Premium Customers (>₹50k):</strong> ${highPremiumCustomers}</p>
        </div>
        
        <div class="insight-card">
            <h4>🚗 Risk & Insurance Patterns</h4>
            <p><strong>Customers with Vehicle Damage History:</strong> ${damageData['Yes'] ? damageData['Yes'].total : 0}</p>
            <p><strong>Damage History → Interest Rate:</strong> ${damageData['Yes'] ? (damageData['Yes'].interested/damageData['Yes'].total*100).toFixed(1) : 0}%</p>
            <p><strong>No Damage History → Interest Rate:</strong> ${damageData['No'] ? (damageData['No'].interested/damageData['No'].total*100).toFixed(1) : 0}%</p>
        </div>
        
        <div class="insight-card">
            <h4>🎯 Marketing Recommendations</h4>
            <p><strong>Target Segment:</strong> Customers aged 25-40 with vehicle damage history</p>
            <p><strong>Potential Revenue:</strong> ~${Math.round(interestedCustomers * avgPremium * 0.3).toLocaleString()} INR from cross-selling</p>
            <p><strong>Action Plan:</strong> Focus on customers with high premium capacity and prior insurance experience</p>
        </div>
    `;
}

// Create business visualizations
function createBusinessVisualizations() {
    if (!trainData) return;
    
    const vizContainer = document.getElementById('business-visualizations');
    if (!vizContainer) return;
    
    vizContainer.innerHTML = '<h3>📊 Customer Analytics Dashboard</h3>';
    
    try {
        // Interest by Gender
        const genderData = {};
        trainData.forEach(row => {
            if (row.Gender && row.Response !== undefined && row.Response !== null) {
                if (!genderData[row.Gender]) {
                    genderData[row.Gender] = { interested: 0, total: 0 };
                }
                genderData[row.Gender].total++;
                if (row.Response === 1) {
                    genderData[row.Gender].interested++;
                }
            }
        });
        
        const genderChartData = [
            { index: 'Male', value: (genderData.Male?.interested / genderData.Male?.total) * 100 || 0 },
            { index: 'Female', value: (genderData.Female?.interested / genderData.Female?.total) * 100 || 0 }
        ];
        
        // Age distribution
        const ageGroups = {
            '18-25': 0, '26-35': 0, '36-45': 0, '46-55': 0, '56+': 0
        };
        
        trainData.forEach(row => {
            if (row.Age) {
                if (row.Age <= 25) ageGroups['18-25']++;
                else if (row.Age <= 35) ageGroups['26-35']++;
                else if (row.Age <= 45) ageGroups['36-45']++;
                else if (row.Age <= 55) ageGroups['46-55']++;
                else ageGroups['56+']++;
            }
        });
        
        const ageChartData = Object.keys(ageGroups).map(ageGroup => ({
            index: ageGroup,
            value: ageGroups[ageGroup]
        }));
        
        vizContainer.innerHTML += `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
                <div style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h4>Interest Rate by Gender</h4>
                    <div id="gender-chart"></div>
                </div>
                <div style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h4>Customer Age Distribution</h4>
                    <div id="age-chart"></div>
                </div>
            </div>
        `;
        
        // Render charts
        tfvis.render.barchart(
            { name: 'Interest Rate by Gender', tab: 'Business Analytics' },
            genderChartData,
            { 
                xLabel: 'Gender', 
                yLabel: 'Interest Rate (%)',
                yAxisDomain: [0, 100]
            }
        );
        
        tfvis.render.barchart(
            { name: 'Customer Age Distribution', tab: 'Business Analytics' },
            ageChartData,
            { 
                xLabel: 'Age Group', 
                yLabel: 'Number of Customers'
            }
        );
        
    } catch (error) {
        console.error('Error creating business visualizations:', error);
    }
}

// FIXED: Single customer prediction with correct feature dimension
async function predictSingle() {
    if (!trainedModel) {
        alert('Please train the model first in ML Specialist mode.');
        return;
    }
    
    try {
        // Get feature dimension from the model
        const inputShape = trainedModel.inputs[0].shape[1];
        console.log('Model expects input shape:', inputShape);
        
        // Collect data from form
        const formData = {
            Age: parseInt(document.getElementById('pred-age').value) || 35,
            Annual_Premium: parseFloat(document.getElementById('pred-premium').value) || 30000,
            Vintage: parseInt(document.getElementById('pred-vintage').value) || 100,
            Gender: document.getElementById('pred-gender').value,
            Driving_License: parseInt(document.getElementById('pred-license').value),
            Previously_Insured: parseInt(document.getElementById('pred-insured').value),
            Vehicle_Age: document.getElementById('pred-vehicle-age').value,
            Vehicle_Damage: document.getElementById('pred-damage').value,
            Region_Code: 28, // Default value
            Policy_Sales_Channel: 26 // Default value
        };
        
        console.log('Form data:', formData);
        
        // Create a mock row that matches training data structure
        const mockRow = {
            Age: formData.Age,
            Region_Code: formData.Region_Code,
            Annual_Premium: formData.Annual_Premium,
            Policy_Sales_Channel: formData.Policy_Sales_Channel,
            Vintage: formData.Vintage,
            Gender: formData.Gender,
            Driving_License: formData.Driving_License,
            Previously_Insured: formData.Previously_Insured,
            Vehicle_Age: formData.Vehicle_Age,
            Vehicle_Damage: formData.Vehicle_Damage
        };
        
        // Extract features using the same preprocessing as training data
        const features = extractSingleFeatures(mockRow);
        console.log('Extracted features length:', features.length);
        console.log('Features:', features);
        
        // Make prediction
        const inputTensor = tf.tensor2d([features]);
        const prediction = trainedModel.predict(inputTensor);
        const probability = (await prediction.data())[0];
        
        // Show result
        const resultDiv = document.getElementById('single-result');
        const threshold = 0.3; // Default threshold for business mode
        const isInterested = probability >= threshold;
        
        resultDiv.style.display = 'block';
        resultDiv.style.background = isInterested ? '#d4edda' : '#f8d7da';
        resultDiv.style.color = isInterested ? '#155724' : '#721c24';
        resultDiv.style.border = '1px solid ' + (isInterested ? '#28a745' : '#dc3545');
        resultDiv.style.borderLeft = '4px solid ' + (isInterested ? '#28a745' : '#dc3545');
        
        resultDiv.innerHTML = `
            <h4>🎯 Prediction Result</h4>
            <p><strong>Interest Probability:</strong> <span style="font-size: 1.2em; font-weight: bold; color: ${isInterested ? '#28a745' : '#dc3545'};">${(probability * 100).toFixed(1)}%</span></p>
            <p><strong>Prediction:</strong> <span style="font-size: 1.1em; font-weight: bold;">${isInterested ? '✅ INTERESTED' : '❌ NOT INTERESTED'}</span></p>
            <p><strong>Confidence Level:</strong> ${probability >= 0.7 ? 'High' : probability >= 0.4 ? 'Medium' : 'Low'}</p>
            <p><strong>Recommended Action:</strong> ${isInterested ? 
                '🎯 Prioritize for targeted marketing campaign' : 
                '📧 Include in general communication'}</p>
        `;
        
        // Clean up tensors
        inputTensor.dispose();
        prediction.dispose();
        
    } catch (error) {
        console.error('Error in single prediction:', error);
        const resultDiv = document.getElementById('single-result');
        resultDiv.style.display = 'block';
        resultDiv.style.background = '#fff5f5';
        resultDiv.style.color = '#721c24';
        resultDiv.innerHTML = `
            <h4>❌ Prediction Error</h4>
            <p>Error making prediction: ${error.message}</p>
            <p>Please ensure the model is properly trained in ML Specialist mode.</p>
        `;
    }
}

// Extract features for single prediction (FIXED version)
function extractSingleFeatures(row) {
    // Use training data for standardization if available
    let standardizedAge = row.Age || 0;
    let standardizedPremium = row.Annual_Premium || 0;
    let standardizedRegion = row.Region_Code || 0;
    let standardizedChannel = row.Policy_Sales_Channel || 0;
    let standardizedVintage = row.Vintage || 0;
    
    if (trainData && trainData.length > 0) {
        const trainAges = trainData.map(r => r.Age).filter(a => a !== null && !isNaN(a));
        const trainPremiums = trainData.map(r => r.Annual_Premium).filter(p => p !== null && !isNaN(p));
        const trainRegions = trainData.map(r => r.Region_Code).filter(c => c !== null && !isNaN(c));
        const trainChannels = trainData.map(r => r.Policy_Sales_Channel).filter(c => c !== null && !isNaN(c));
        const trainVintages = trainData.map(r => r.Vintage).filter(v => v !== null && !isNaN(v));
        
        standardizedAge = (row.Age - calculateMean(trainAges)) / (calculateStdDev(trainAges) || 1);
        standardizedPremium = (row.Annual_Premium - calculateMean(trainPremiums)) / (calculateStdDev(trainPremiums) || 1);
        standardizedRegion = (row.Region_Code - calculateMean(trainRegions)) / (calculateStdDev(trainRegions) || 1);
        standardizedChannel = (row.Policy_Sales_Channel - calculateMean(trainChannels)) / (calculateStdDev(trainChannels) || 1);
        standardizedVintage = (row.Vintage - calculateMean(trainVintages)) / (calculateStdDev(trainVintages) || 1);
    }
    
    // Start with numerical features
    let features = [
        isNaN(standardizedAge) ? 0 : standardizedAge,
        isNaN(standardizedPremium) ? 0 : standardizedPremium,
        isNaN(standardizedRegion) ? 0 : standardizedRegion,
        isNaN(standardizedChannel) ? 0 : standardizedChannel,
        isNaN(standardizedVintage) ? 0 : standardizedVintage
    ];
    
    // One-hot encoding for categorical features
    const genderOneHot = oneHotEncode(row.Gender, ['Male', 'Female']);
    const drivingLicenseOneHot = oneHotEncode(row.Driving_License?.toString(), ['0', '1']);
    const previouslyInsuredOneHot = oneHotEncode(row.Previously_Insured?.toString(), ['0', '1']);
    const vehicleAgeOneHot = oneHotEncode(row.Vehicle_Age, ['< 1 Year', '1-2 Year', '> 2 Years']);
    const vehicleDamageOneHot = oneHotEncode(row.Vehicle_Damage, ['Yes', 'No']);
    
    // Combine all features
    features = features.concat(
        genderOneHot, 
        drivingLicenseOneHot, 
        previouslyInsuredOneHot, 
        vehicleAgeOneHot, 
        vehicleDamageOneHot
    );
    
    // Add engineered features to match training dimension
    const youngRiskyDriver = (row.Age < 30 && row.Vehicle_Damage === 'Yes') ? 1 : 0;
    features.push(youngRiskyDriver);
    
    const lapsedCustomer = (row.Previously_Insured === 1 && row.Vehicle_Damage === 'Yes') ? 1 : 0;
    features.push(lapsedCustomer);
    
    // Premium segments
    const premiumSegment = row.Annual_Premium < 20000 ? 0 : row.Annual_Premium < 50000 ? 1 : 2;
    const premiumSegmentOneHot = oneHotEncode(premiumSegment.toString(), ['0', '1', '2']);
    features = features.concat(premiumSegmentOneHot);
    
    console.log('Final feature vector length:', features.length);
    return features;
}

// Business prediction function
async function predictBusiness() {
    if (!trainedModel) {
        alert('Please train the model first in ML Specialist mode.');
        return;
    }
    
    const businessFile = document.getElementById('business-file').files[0];
    if (!businessFile) {
        alert('Please upload a CSV file for prediction.');
        return;
    }
    
    const outputDiv = document.getElementById('business-prediction-output');
    outputDiv.innerHTML = 'Processing business prediction...';
    
    try {
        // Load and process business data
        const businessText = await readFile(businessFile);
        const businessData = parseCSV(businessText);
        
        // Preprocess business data (simplified version)
        const businessFeatures = businessData.map(row => extractSingleFeatures(row));
        const customerIds = businessData.map(row => row.id || row.customer_id || `cust_${Math.random().toString(36).substr(2, 9)}`);
        
        // Make predictions
        const featuresTensor = tf.tensor2d(businessFeatures);
        const predictions = trainedModel.predict(featuresTensor);
        const predValues = await predictions.data();
        
        // Create results
        const threshold = 0.3;
        const results = customerIds.map((id, i) => ({
            CustomerId: id,
            Interested: predValues[i] >= threshold ? 1 : 0,
            Probability: predValues[i],
            Recommendation: predValues[i] >= threshold ? 'High Priority' : 'Standard'
        }));
        
        // Show summary
        const interestedCount = results.filter(r => r.Interested === 1).length;
        const totalCount = results.length;
        const interestRate = (interestedCount / totalCount * 100).toFixed(1);
        
        outputDiv.innerHTML = `
            <div style="background: #e9f7ef; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                <h4>📊 Business Prediction Summary</h4>
                <p><strong>Total Customers Analyzed:</strong> ${totalCount}</p>
                <p><strong>High Priority Leads:</strong> ${interestedCount} (${interestRate}%)</p>
                <p><strong>Potential Campaign Size:</strong> ${interestedCount} customers</p>
            </div>
            <div style="max-height: 400px; overflow-y: auto;">
                <h4>Customer Predictions (First 20)</h4>
                ${createBusinessPredictionTable(results.slice(0, 20))}
            </div>
        `;
        
        // Clean up
        featuresTensor.dispose();
        predictions.dispose();
        
    } catch (error) {
        console.error('Error in business prediction:', error);
        outputDiv.innerHTML = `<div style="color: red;">Error in business prediction: ${error.message}</div>`;
    }
}

function createBusinessPredictionTable(results) {
    if (results.length === 0) return '<p>No results to display</p>';
    
    let tableHTML = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
                <tr style="background: #f8f9fa;">
                    <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Customer ID</th>
                    <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Interest Probability</th>
                    <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Priority</th>
                    <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Recommendation</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    results.forEach(result => {
        const probabilityPercent = (result.Probability * 100).toFixed(1);
        const priorityColor = result.Interested ? '#28a745' : '#6c757d';
        
        tableHTML += `
            <tr>
                <td style="padding: 10px; border: 1px solid #ddd;">${result.CustomerId}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">
                    <span style="color: ${result.Probability >= 0.7 ? '#28a745' : result.Probability >= 0.4 ? '#ffc107' : '#dc3545'}; font-weight: bold;">
                        ${probabilityPercent}%
                    </span>
                </td>
                <td style="padding: 10px; border: 1px solid #ddd; color: ${priorityColor}; font-weight: bold;">
                    ${result.Interested ? 'HIGH' : 'LOW'}
                </td>
                <td style="padding: 10px; border: 1px solid #ddd;">${result.Recommendation}</td>
            </tr>
        `;
    });
    
    tableHTML += '</tbody></table>';
    return tableHTML;
}

// Update model status
function updateModelStatus() {
    const statusElement = document.getElementById('model-status');
    if (trainedModel) {
        statusElement.innerHTML = '🟢 Model Ready for Predictions';
        statusElement.style.color = 'green';
    } else {
        statusElement.innerHTML = '🔴 No Model Available - Train First';
        statusElement.style.color = '#dc3545';
    }
}

// Keep the rest of your existing functions (loadData, parseCSV, createModel, trainModel, etc.)
// but add this line at the end of trainModel to save the trained model:
const originalTrainModel = trainModel;
trainModel = async function() {
    await originalTrainModel.call(this);
    trainedModel = model;
    updateModelStatus();
    console.log('Model saved for business predictions');
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('Health Insurance Prediction App initialized');
    updateModelStatus();
    switchMode(APP_MODE.TRAINING); // Start in ML Specialist mode
    
    // Close visor on page load
    if (tfvis.visor().isOpen()) {
        tfvis.visor().close();
    }
});

// Add these helper functions if they don't exist
function calculateMean(values) {
    if (!values || values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function calculateStdDev(values) {
    if (!values || values.length === 0) return 0;
    const mean = calculateMean(values);
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(variance);
}

function oneHotEncode(value, categories) {
    if (!categories || categories.length === 0) return [];
    const encoding = new Array(categories.length).fill(0);
    const index = categories.indexOf(value);
    if (index !== -1) {
        encoding[index] = 1;
    }
    return encoding;
}

// Include all your existing functions below (preprocessData, extractFeatures, createModel, trainModel, etc.)
// Make sure they're the same as in your original app.js

// Preprocess the data - OPTIMIZED VERSION
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
            // Calculate imputation values from training data - OPTIMIZED
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
            
            // Preprocess training data in batches to avoid freezing
            console.log('Preprocessing training data...');
            preprocessedTrainData = {
                features: [],
                labels: []
            };
            
            const batchSize = 1000; // Process in batches of 1000
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
            
            console.log('First 5 processed feature vectors:');
            for (let i = 0; i < Math.min(5, preprocessedTrainData.features.length); i++) {
                console.log(`Sample ${i}:`, preprocessedTrainData.features[i]);
                console.log(`Corresponding label:`, preprocessedTrainData.labels[i]);
            }
            console.log('Converting to tensors...');

            // Convert to tensors
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
            
        } catch (error) {
            console.error('Error during preprocessing:', error);
            outputDiv.innerHTML = `<div style="color: red;">
                <p><strong>Error during preprocessing:</strong></p>
                <p>${error.message}</p>
                <p>Check console for details</p>
            </div>`;
        }
    }, 100); // Small delay to ensure UI updates
}

// Extract features from a row with imputation and normalization
function extractFeatures(row, ageMedian, annualPremiumMedian, regionCodeMedian, policyChannelMedian) {
    // Safe imputation
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
    
    // Robust standardization
    const standardizedAge = (age - calculateMean(trainAges)) / (calculateStdDev(trainAges) || 1);
    const standardizedPremium = (annualPremium - calculateMean(trainPremiums)) / (calculateStdDev(trainPremiums) || 1);
    const standardizedRegion = (regionCode - calculateMean(trainRegions)) / (calculateStdDev(trainRegions) || 1);
    const standardizedChannel = (policyChannel - calculateMean(trainChannels)) / (calculateStdDev(trainChannels) || 1);
    const standardizedVintage = (vintage - calculateMean(trainVintages)) / (calculateStdDev(trainVintages) || 1);
    
    // One-hot encoding
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
    
    // CRITICAL: Add domain-specific engineered features
    // 1. Age groups (insurance relevance)
    const ageGroup = age < 25 ? 0 : age < 40 ? 1 : age < 60 ? 2 : 3;
    //const ageGroupOneHot = oneHotEncode(ageGroup.toString(), ['0', '1', '2', '3']);
    //features = features.concat(ageGroupOneHot);
    
    // 2. Premium to age ratio (affordability indicator)
    //const premiumToAgeRatio = annualPremium / (age || 1);
    //features.push(isNaN(premiumToAgeRatio) ? 0 : premiumToAgeRatio / 1000);
    
    // 3. Risk profile: Young drivers with vehicle damage
    const youngRiskyDriver = (age < 30 && row.Vehicle_Damage === 'Yes') ? 1 : 0;
    features.push(youngRiskyDriver);
    
    // 4. Previously insured but no current insurance (potential customer)
    const lapsedCustomer = (row.Previously_Insured === 1 && row.Vehicle_Damage === 'Yes') ? 1 : 0;
    features.push(lapsedCustomer);
    
    // 5. Premium segments
    const premiumSegment = annualPremium < 20000 ? 0 : annualPremium < 50000 ? 1 : 2;
    const premiumSegmentOneHot = oneHotEncode(premiumSegment.toString(), ['0', '1', '2']);
    features = features.concat(premiumSegmentOneHot);
    
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
    if (!values || values.length === 0) return 0;
    
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

// [Rest of the functions remain the same as previous version: createModel, trainModel, updateMetrics, plotROC, predict, createPredictionTable, exportResults, toggleVisor, recreateVisualizations]

// Create the model - UPDATED VERSION
function createModel() {
    if (!preprocessedTrainData) {
        alert('Please preprocess data first.');
        return;
    }
    
    const inputShape = preprocessedTrainData.features.shape[1];
    
    console.log('Creating model with input shape:', inputShape);
    
    // Clear any existing model
    if (model) {
        model.dispose();
    }
    
    model = tf.sequential();
    
    // Simplified architecture
    model.add(tf.layers.dense({
        units: 24,
        activation: 'relu',
        inputShape: [inputShape],
        kernelRegularizer: tf.regularizers.l2({l2: 0.01})
    }));
    
    model.add(tf.layers.dropout({rate: 0.3}));
    
    // Output layer
    model.add(tf.layers.dense({
        units: 1,
        activation: 'sigmoid'
    }));
    
    // Compilation
    model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
    });
    
    // UPDATED MODEL SUMMARY
    const summaryDiv = document.getElementById('model-summary');
    summaryDiv.innerHTML = '<h3>Vehicle Insurance Cross-Selling Model</h3>';
    summaryDiv.innerHTML += `
        <p><strong>Architecture:</strong> 2-layer Neural Network (24 → 1 neurons)</p>
        <p><strong>Purpose:</strong> Predict customer interest in Vehicle Insurance</p>
        <p><strong>Optimization:</strong> Precision-focused with early stopping</p>
        <p><strong>Business Value:</strong> Targeted marketing & revenue optimization</p>
        <p><strong>Total Parameters:</strong> ${model.countParams().toLocaleString()}</p>
    `;
    
    document.getElementById('train-btn').disabled = false;
}

// Helper function for oversampling minority class
// IMPROVED oversampling with synthetic samples
async function oversampleMinorityClass(features, labels, multiplier = 2) { // Уменьшили с 3 до 2
    const featuresArray = await features.array();
    const labelsArray = await labels.array();
    
    const minorityFeatures = [];
    const minorityLabels = [];
    const majorityFeatures = [];
    const majorityLabels = [];
    
    // Разделяем на majority и minority классы
    for (let i = 0; i < labelsArray.length; i++) {
        if (labelsArray[i] === 1) {
            minorityFeatures.push(featuresArray[i]);
            minorityLabels.push(1);
        } else {
            majorityFeatures.push(featuresArray[i]);
            majorityLabels.push(0);
        }
    }
    
    console.log(`Minority class: ${minorityFeatures.length} samples`);
    console.log(`Majority class: ${majorityFeatures.length} samples`);
    
    // Увеличиваем minority класс с SYNTHETIC SAMPLES
    const oversampledMinorityFeatures = [];
    const oversampledMinorityLabels = [];
    
    // Сначала добавим оригинальные samples
    oversampledMinorityFeatures.push(...minorityFeatures);
    oversampledMinorityLabels.push(...minorityLabels);
    
    // Затем добавим synthetic samples
    const neededSamples = minorityFeatures.length * (multiplier - 1);
    for (let i = 0; i < neededSamples; i++) {
        const randomIndex = Math.floor(Math.random() * minorityFeatures.length);
        const originalFeatures = minorityFeatures[randomIndex];
        
        // Создаем synthetic sample с небольшими вариациями
        const syntheticFeatures = createSyntheticSample(originalFeatures, 0.05); // 5% вариация
        
        oversampledMinorityFeatures.push(syntheticFeatures);
        oversampledMinorityLabels.push(1);
    }
    
    // Объединяем обратно
    const balancedFeatures = [...majorityFeatures, ...oversampledMinorityFeatures];
    const balancedLabels = [...majorityLabels, ...oversampledMinorityLabels];
    
    // Перемешиваем
    const shuffled = shuffleArrays(balancedFeatures, balancedLabels);
    
    console.log(`After oversampling - total: ${shuffled.features.length} samples`);
    console.log(`Synthetic samples created: ${neededSamples}`);
    
    return {
        features: tf.tensor2d(shuffled.features),
        labels: tf.tensor1d(shuffled.labels)
    };
}

// Функция для создания synthetic samples - ДОБАВЬТЕ ЭТУ ФУНКЦИЮ
function createSyntheticSample(features, variation = 0.05) {
    return features.map(f => {
        // Добавляем небольшой случайный шум, но избегаем изменения бинарных фичей
        const isBinary = f === 0 || f === 1;
        if (isBinary) {
            // Для бинарных фичей оставляем как есть или с очень малой вероятностью меняем
            return Math.random() < 0.02 ? (1 - f) : f;
        } else {
            // Для числовых фичей добавляем небольшой шум
            return f + (Math.random() - 0.5) * variation * Math.abs(f);
        }
    });
}

// Helper function to shuffle arrays
function shuffleArrays(features, labels) {
    const combined = features.map((f, i) => ({ feature: f, label: labels[i] }));
    
    // Fisher-Yates shuffle
    for (let i = combined.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [combined[i], combined[j]] = [combined[j], combined[i]];
    }
    
    return {
        features: combined.map(item => item.feature),
        labels: combined.map(item => item.label)
    };
}
// Train the model
// Train the model - IMPROVED VERSION WITH OVERSAMPLING
async function trainModel() {
    if (!model || !preprocessedTrainData) {
        alert('Please create model first.');
        return;
    }
    
    const statusDiv = document.getElementById('training-status');
    statusDiv.innerHTML = 'Training model with Early Stopping...';
    
    try {
        // Split data
        const splitIndex = Math.floor(preprocessedTrainData.features.shape[0] * 0.8);
        
        const trainFeatures = preprocessedTrainData.features.slice(0, splitIndex);
        const trainLabels = preprocessedTrainData.labels.slice(0, splitIndex);
        
        const valFeatures = preprocessedTrainData.features.slice(splitIndex);
        const valLabels = preprocessedTrainData.labels.slice(splitIndex);
        
        // Store validation data
        validationData = valFeatures;
        validationLabels = valLabels;
        
        const epochs = parseInt(document.getElementById('epochs').value);
        
        // УПРОЩЕННЫЕ CLASS WEIGHTS
        const labelsArray = await trainLabels.data();
        const positiveCount = labelsArray.filter(label => label === 1).length;
        const negativeCount = labelsArray.length - positiveCount;
        
        // Более консервативные веса
        const positiveWeight = Math.min(negativeCount / positiveCount, 3); // Макс 3x вместо 5x
        
        console.log('Class distribution:', {
            positive: positiveCount,
            negative: negativeCount,
            positiveWeight: positiveWeight.toFixed(2)
        });
        
        const classWeight = { 
            0: 1, 
            1: positiveWeight
        };

        // 🔥 EARLY STOPPING VARIABLES
        let bestValLoss = Infinity;
        let patience = 5; // Сколько эпох ждать ухудшения
        let patienceCounter = 0;
        let bestWeights = null;

        // УПРОЩЕННАЯ ТРЕНИРОВКА С EARLY STOPPING
        trainingHistory = await model.fit(trainFeatures, trainLabels, {
            epochs: epochs,
            batchSize: 32,
            validationData: [valFeatures, valLabels],
            classWeight: classWeight,
            callbacks: {
                onEpochBegin: async (epoch, logs) => {
                    // Сохраняем лучшие веса в начале каждой эпохи
                    if (epoch === 0) {
                        bestWeights = model.getWeights();
                    }
                },
                onEpochEnd: async (epoch, logs) => {
                    const status = `Epoch ${epoch + 1}/${epochs} - loss: ${logs.loss.toFixed(4)}, acc: ${logs.acc.toFixed(4)}, val_loss: ${logs.val_loss.toFixed(4)}, val_acc: ${logs.val_acc.toFixed(4)}`;
                    
                    // 🔥 EARLY STOPPING LOGIC
                    if (logs.val_loss < bestValLoss) {
                        bestValLoss = logs.valLoss;
                        patienceCounter = 0;
                        // Сохраняем лучшие веса
                        bestWeights = model.getWeights();
                        statusDiv.innerHTML = status + ' ✅ (Best val_loss)';
                    } else {
                        patienceCounter++;
                        statusDiv.innerHTML = status + ` ⚠️ (Patience: ${patienceCounter}/${patience})`;
                        
                        // Если терпение исчерпано - останавливаем training
                        if (patienceCounter >= patience) {
                            console.log(`Early stopping triggered at epoch ${epoch + 1}`);
                            model.stopTraining = true;
                            
                            // Восстанавливаем лучшие веса
                            if (bestWeights) {
                                model.setWeights(bestWeights);
                                console.log('Restored best model weights');
                            }
                        }
                    }
                    
                    console.log(status);
                },
                onTrainEnd: () => {
                    statusDiv.innerHTML += '<p style="color: green;">Training completed!</p>';
                    if (patienceCounter >= patience) {
                        statusDiv.innerHTML += '<p style="color: orange;">Early stopping was triggered</p>';
                    }
                    
                    // Автоматически найти оптимальный threshold
                    setTimeout(() => {
                        validationPredictions = model.predict(validationData);
                        updateMetrics();
                    }, 500);
                }
            }
        });
        
        // Включаем UI элементы
        document.getElementById('threshold-slider').disabled = false;
        document.getElementById('threshold-slider').addEventListener('input', updateMetrics);
        document.getElementById('predict-btn').disabled = false;
        
    } catch (error) {
        console.error('Error during training:', error);
        statusDiv.innerHTML = `<p style="color: red;">Error during training: ${error.message}</p>`;
    }
}

async function findOptimalThreshold() {
    if (!validationPredictions || !validationLabels) return;
    
    const predVals = await validationPredictions.array();
    const trueVals = await validationLabels.array();
    
    let bestF1 = 0;
    let bestThreshold = 0.5;
    
    // Test different thresholds
    for (let threshold = 0.1; threshold <= 0.9; threshold += 0.05) {
        let tp = 0, tn = 0, fp = 0, fn = 0;
        
        for (let i = 0; i < predVals.length; i++) {
            const prediction = predVals[i] >= threshold ? 1 : 0;
            const actual = trueVals[i];
            
            if (prediction === 1 && actual === 1) tp++;
            else if (prediction === 0 && actual === 0) tn++;
            else if (prediction === 1 && actual === 0) fp++;
            else if (prediction === 0 && actual === 1) fn++;
        }
        
        const precision = tp / (tp + fp) || 0;
        const recall = tp / (tp + fn) || 0;
        const f1 = 2 * (precision * recall) / (precision + recall) || 0;
        
        if (f1 > bestF1) {
            bestF1 = f1;
            bestThreshold = threshold;
        }
    }
    
    console.log('Optimal threshold for F1 score:', bestThreshold.toFixed(2), 'F1:', bestF1.toFixed(4));
    return bestThreshold;
}

// Call this after training
async function enhanceModelFurther() {
    const optimalThreshold = await findOptimalThreshold();
    document.getElementById('threshold-slider').value = optimalThreshold;
    updateMetrics();
}

// Update metrics based on threshold
async function updateMetrics() {
    if (!validationPredictions || !validationLabels) return;
    
    const threshold = parseFloat(document.getElementById('threshold-slider').value);
    document.getElementById('threshold-value').textContent = threshold.toFixed(2);
    
    try {
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
        
        // Enhanced confusion matrix with percentages
        const total = tp + tn + fp + fn;
        const cmDiv = document.getElementById('confusion-matrix');
        cmDiv.innerHTML = `
            <div style="overflow-x: auto;">
                <h4>Confusion Matrix</h4>
                <table style="border-collapse: collapse; width: 100%; min-width: 350px;">
                    <tr>
                        <th style="border: 1px solid #ddd; padding: 12px;"></th>
                        <th style="border: 1px solid #ddd; padding: 12px;">Predicted Interested</th>
                        <th style="border: 1px solid #ddd; padding: 12px;">Predicted Not Interested</th>
                    </tr>
                    <tr>
                        <th style="border: 1px solid #ddd; padding: 12px;">Actual Interested</th>
                        <td style="border: 1px solid #ddd; padding: 12px; text-align: center; background-color: #d4edda;">
                            ${tp}<br><small>(${(tp/total*100).toFixed(1)}%)</small>
                        </td>
                        <td style="border: 1px solid #ddd; padding: 12px; text-align: center; background-color: #f8d7da;">
                            ${fn}<br><small>(${(fn/total*100).toFixed(1)}%)</small>
                        </td>
                    </tr>
                    <tr>
                        <th style="border: 1px solid #ddd; padding: 12px;">Actual Not Interested</th>
                        <td style="border: 1px solid #ddd; padding: 12px; text-align: center; background-color: #f8d7da;">
                            ${fp}<br><small>(${(fp/total*100).toFixed(1)}%)</small>
                        </td>
                        <td style="border: 1px solid #ddd; padding: 12px; text-align: center; background-color: #d4edda;">
                            ${tn}<br><small>(${(tn/total*100).toFixed(1)}%)</small>
                        </td>
                    </tr>
                </table>
            </div>
        `;
        
        // Comprehensive performance metrics
        const precision = tp / (tp + fp) || 0;
        const recall = tp / (tp + fn) || 0;
        const f1 = 2 * (precision * recall) / (precision + recall) || 0;
        const accuracy = (tp + tn) / total || 0;
        
        // Specificity (True Negative Rate)
        const specificity = tn / (tn + fp) || 0;
        
        // Balanced Accuracy
        const balancedAccuracy = (recall + specificity) / 2;
        
        const metricsDiv = document.getElementById('performance-metrics');
        metricsDiv.innerHTML = `
            <div style="font-size: 14px; background: #f8f9fa; padding: 15px; border-radius: 8px;">
                <h4>Performance Metrics</h4>
                <p><strong>Accuracy:</strong> ${(accuracy * 100).toFixed(2)}%</p>
                <p><strong>Balanced Accuracy:</strong> ${(balancedAccuracy * 100).toFixed(2)}%</p>
                <p><strong>Precision:</strong> ${precision.toFixed(4)}</p>
                <p><strong>Recall (Sensitivity):</strong> ${recall.toFixed(4)}</p>
                <p><strong>Specificity:</strong> ${specificity.toFixed(4)}</p>
                <p><strong>F1 Score:</strong> ${f1.toFixed(4)}</p>
                <p><strong>Optimal Threshold:</strong> ~0.3-0.4 for imbalanced data</p>
            </div>
        `;
        
        // Enhanced ROC with AUC
        await plotROC(trueVals, predVals);
        
    } catch (error) {
        console.error('Error updating enhanced metrics:', error);
    }
}

// Plot ROC curve
async function plotROC(trueLabels, predictions) {
    try {
        const thresholds = Array.from({ length: 100 }, (_, i) => i / 100);
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
            
            const tpr = tp / (tp + fn) || 0;  // True Positive Rate
            const fpr = fp / (fp + tn) || 0;  // False Positive Rate
            
            rocData.push({ threshold, fpr, tpr });
        });
        
        // FIXED AUC calculation (trapezoidal rule)
        let auc = 0;
        rocData.sort((a, b) => a.fpr - b.fpr); // Sort by FPR
        
        for (let i = 1; i < rocData.length; i++) {
            const width = rocData[i].fpr - rocData[i-1].fpr;
            const avgHeight = (rocData[i].tpr + rocData[i-1].tpr) / 2;
            auc += width * avgHeight;
        }
        
        console.log('AUC calculated:', auc);
        
        // Plot ROC curve
        if (auc >= 0 && auc <= 1) {
            tfvis.render.linechart(
                { name: 'ROC Curve', tab: 'Evaluation' },
                { values: rocData.map(d => ({ x: d.fpr, y: d.tpr })) },
                { 
                    xLabel: 'False Positive Rate', 
                    yLabel: 'True Positive Rate',
                    series: ['ROC Curve (AUC: ' + auc.toFixed(4) + ')'],
                    width: 400,
                    height: 400
                }
            );
            
            // Update metrics with correct AUC
            const metricsDiv = document.getElementById('performance-metrics');
            if (metricsDiv) {
                const currentHTML = metricsDiv.innerHTML;
                if (!currentHTML.includes('AUC')) {
                    metricsDiv.innerHTML = currentHTML.replace(
                        '</div>', 
                        `<p><strong>AUC:</strong> ${auc.toFixed(4)}</p></div>`
                    );
                }
            }
        } else {
            console.warn('Invalid AUC value:', auc);
        }
        
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
        // Color code based on probability
        if (prob >= 0.7) {
            tdProb.style.color = 'green';
        } else if (prob >= 0.3) {
            tdProb.style.color = 'orange';
        } else {
            tdProb.style.color = 'red';
        }
        tr.appendChild(tdProb);
        
        table.appendChild(tr);
    });
    
    return table;
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
        // Get predictions
        const predValues = await testPredictions.data();
        const threshold = parseFloat(document.getElementById('threshold-slider').value);
        
        // Create submission CSV (id, Response)
        let submissionCSV = 'id,Response\n';
        preprocessedTestData.customerIds.forEach((id, i) => {
            submissionCSV += `${id},${predValues[i] >= threshold ? 1 : 0}\n`;
        });
        
        // Create probabilities CSV (id, Probability)
        let probabilitiesCSV = 'id,Probability\n';
        preprocessedTestData.customerIds.forEach((id, i) => {
            probabilitiesCSV += `${id},${predValues[i].toFixed(6)}\n`;
        });
        
        // Create download links
        const submissionLink = document.createElement('a');
        submissionLink.href = URL.createObjectURL(new Blob([submissionCSV], { type: 'text/csv' }));
        submissionLink.download = 'insurance_predictions.csv';
        
        const probabilitiesLink = document.createElement('a');
        probabilitiesLink.href = URL.createObjectURL(new Blob([probabilitiesCSV], { type: 'text/csv' }));
        probabilitiesLink.download = 'prediction_probabilities.csv';
        
        // Trigger downloads
        submissionLink.click();
        probabilitiesLink.click();
        
        statusDiv.innerHTML = `
            <div style="padding: 15px; background-color: #e9f7ef; border-radius: 5px;">
                <p><strong>Export completed!</strong></p>
                <p>Downloaded files:</p>
                <ul>
                    <li>insurance_predictions.csv (Binary predictions)</li>
                    <li>prediction_probabilities.csv (Prediction probabilities)</li>
                </ul>
            </div>
        `;
    } catch (error) {
        console.error('Error during export:', error);
        statusDiv.innerHTML = `Error during export: ${error.message}`;
    }
}

// Toggle visor function
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

// Recreate visualizations
function recreateVisualizations() {
    if (!trainData) return;
    
    // Clear existing tabs
    const visor = tfvis.visor();
    const tabs = visor.getTabs();
    tabs.forEach(tab => {
        visor.removeTab(tab);
    });
    
    createVisualizations();
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Close visor on page load
    if (tfvis.visor().isOpen()) {
        tfvis.visor().close();
    }
    
    console.log('Health Insurance Prediction App initialized');
});

function resetModelSession() {
    console.log('Resetting model session...');
    
    // Dispose of tensors to free memory
    if (validationPredictions) {
        validationPredictions.dispose();
        validationPredictions = null;
    }
    if (validationData) {
        validationData.dispose();
        validationData = null;
    }
    if (validationLabels) {
        validationLabels.dispose();
        validationLabels = null;
    }
    
    // Clear UI
    document.getElementById('confusion-matrix').innerHTML = '';
    document.getElementById('performance-metrics').innerHTML = '';
    document.getElementById('threshold-slider').value = 0.5;
    document.getElementById('threshold-value').textContent = '0.50';
    
    console.log('Model session reset complete');
}

const APP_MODE = {
    TRAINING: 'training',
    PREDICTION: 'prediction'
};

let currentMode = APP_MODE.TRAINING;
let trainedModel = null;

// Switch between ML Specialist and Business User modes
function switchMode(mode) {
    currentMode = mode;
    
    if (mode === APP_MODE.TRAINING) {
        // Show all training sections
        document.querySelectorAll('.card').forEach(card => {
            card.style.display = 'block';
        });
        document.getElementById('ml-mode-btn').style.background = 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)';
        document.getElementById('business-mode-btn').style.background = '#6c757d';
        document.getElementById('mode-indicator').textContent = 'Current Mode: ML Specialist';
        document.getElementById('mode-indicator').style.color = '#007bff';
    } else {
        // Business User Mode - hide training sections, show only prediction
        document.querySelectorAll('.card').forEach(card => {
            const cardTitle = card.querySelector('h2');
            if (cardTitle && (
                cardTitle.textContent.includes('Data Upload') ||
                cardTitle.textContent.includes('Data Exploration') ||
                cardTitle.textContent.includes('Data Preprocessing') ||
                cardTitle.textContent.includes('Model Configuration') ||
                cardTitle.textContent.includes('Model Training') ||
                cardTitle.textContent.includes('Model Evaluation') ||
                cardTitle.textContent.includes('Prediction') ||
                cardTitle.textContent.includes('Export Results')
            )) {
                card.style.display = 'none';
            }
        });
        
        // Show single prediction card
        const singlePredCard = document.querySelector('.card h2');
        if (singlePredCard && singlePredCard.textContent.includes('Single Customer Prediction')) {
            singlePredCard.closest('.card').style.display = 'block';
        }
        
        document.getElementById('ml-mode-btn').style.background = '#6c757d';
        document.getElementById('business-mode-btn').style.background = 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)';
        document.getElementById('mode-indicator').textContent = 'Current Mode: Business User';
        document.getElementById('mode-indicator').style.color = '#28a745';
        
        if (!trainedModel) {
            alert('No trained model available. Please train the model in ML Specialist mode first.');
            switchMode(APP_MODE.TRAINING);
            return;
        }
    }
    updateModelStatus();
}

// Update model status indicator
function updateModelStatus() {
    const statusElement = document.getElementById('model-status');
    if (trainedModel) {
        statusElement.innerHTML = '🟢 Model Ready for Predictions';
        statusElement.style.color = 'green';
    } else {
        statusElement.innerHTML = '🔴 No Model Available - Train First';
        statusElement.style.color = '#dc3545';
    }
}

// Enhanced Business Insights
function generateBusinessInsights() {
    if (!trainData || trainData.length === 0) {
        console.log('No data available for business insights');
        return;
    }
    
    const insightsDiv = document.getElementById('business-insights');
    if (!insightsDiv) {
        console.error('Business insights div not found');
        return;
    }
    
    insightsDiv.innerHTML = '<h3>📊 Business Insights & Customer Analysis</h3>';
    
    // 1. Age Analysis
    const ages = trainData.map(row => row.Age).filter(age => age !== null && !isNaN(age));
    const avgAge = calculateMean(ages);
    const youngCustomers = trainData.filter(row => row.Age < 30).length;
    const youngInterestRate = youngCustomers > 0 ? 
        (trainData.filter(row => row.Age < 30 && row.Response === 1).length / youngCustomers * 100) : 0;
    
    // 2. Premium Analysis
    const premiums = trainData.map(row => row.Annual_Premium).filter(p => p !== null && !isNaN(p));
    const avgPremium = calculateMean(premiums);
    const highPremiumCustomers = trainData.filter(row => row.Annual_Premium > 50000).length;
    
    // 3. Vehicle Damage Analysis
    const damageData = {};
    trainData.forEach(row => {
        if (row.Vehicle_Damage && row.Response !== undefined && row.Response !== null) {
            if (!damageData[row.Vehicle_Damage]) {
                damageData[row.Vehicle_Damage] = { interested: 0, total: 0 };
            }
            damageData[row.Vehicle_Damage].total++;
            if (row.Response === 1) damageData[row.Vehicle_Damage].interested++;
        }
    });
    
    // 4. Previously Insured Analysis
    const insuredData = {};
    trainData.forEach(row => {
        if (row.Previously_Insured !== undefined && row.Previously_Insured !== null && row.Response !== undefined) {
            const key = row.Previously_Insured === 1 ? 'Yes' : 'No';
            if (!insuredData[key]) {
                insuredData[key] = { interested: 0, total: 0 };
            }
            insuredData[key].total++;
            if (row.Response === 1) insuredData[key].interested++;
        }
    });
    
    const totalCustomers = trainData.length;
    const interestedCustomers = trainData.filter(row => row.Response === 1).length;
    const overallInterestRate = (interestedCustomers / totalCustomers * 100);
    
    insightsDiv.innerHTML += `
        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 15px 0;">
            <h4>🎯 Customer Demographics</h4>
            <p><strong>Total Customers Analyzed:</strong> ${totalCustomers.toLocaleString()}</p>
            <p><strong>Average Customer Age:</strong> ${avgAge.toFixed(1)} years</p>
            <p><strong>Young Customers (<30):</strong> ${youngCustomers} (${(youngCustomers/totalCustomers*100).toFixed(1)}% of portfolio)</p>
            <p><strong>Young Customer Interest Rate:</strong> ${youngInterestRate.toFixed(1)}%</p>
            <p><strong>Average Annual Premium:</strong> ₹${avgPremium.toFixed(0)}</p>
            <p><strong>High-Premium Customers (>₹50k):</strong> ${highPremiumCustomers}</p>
        </div>
        
        <div style="background: #e8f4fd; padding: 20px; border-radius: 10px; margin: 15px 0;">
            <h4>🚗 Vehicle Risk Analysis</h4>
            <p><strong>Customers with Vehicle Damage History:</strong> ${damageData['Yes'] ? damageData['Yes'].total : 0}</p>
            <p><strong>Damage History → Interest Rate:</strong> ${damageData['Yes'] ? (damageData['Yes'].interested/damageData['Yes'].total*100).toFixed(1) : 0}%</p>
            <p><strong>No Damage History → Interest Rate:</strong> ${damageData['No'] ? (damageData['No'].interested/damageData['No'].total*100).toFixed(1) : 0}%</p>
            <p><strong>Previously Insured Customers:</strong> ${insuredData['Yes'] ? insuredData['Yes'].total : 0}</p>
            <p><strong>Previously Insured → Interest Rate:</strong> ${insuredData['Yes'] ? (insuredData['Yes'].interested/insuredData['Yes'].total*100).toFixed(1) : 0}%</p>
        </div>
        
        <div style="background: #fff3cd; padding: 20px; border-radius: 10px; margin: 15px 0;">
            <h4>📈 Portfolio Insights</h4>
            <p><strong>Overall Interest Rate:</strong> ${overallInterestRate.toFixed(1)}%</p>
            <p><strong>Interested Customers:</strong> ${interestedCustomers}</p>
            <p><strong>Market Potential:</strong> Based on current portfolio, ~${Math.round(interestedCustomers * 0.3)} additional policies possible with targeted marketing</p>
            <p><strong>Recommendation:</strong> Focus outreach on customers with vehicle damage history and younger demographics</p>
        </div>
    `;
}

// Single customer prediction
async function predictSingle() {
    if (!trainedModel) {
        alert('Please train the model first in ML Specialist mode or load a pre-trained model.');
        return;
    }
    
    try {
        // Collect data from form
        const age = parseInt(document.getElementById('pred-age').value) || 35;
        const annualPremium = parseFloat(document.getElementById('pred-premium').value) || 30000;
        const vintage = parseInt(document.getElementById('pred-vintage').value) || 100;
        const gender = document.getElementById('pred-gender').value;
        const drivingLicense = document.getElementById('pred-license').value;
        const previouslyInsured = document.getElementById('pred-insured').value;
        const vehicleAge = document.getElementById('pred-vehicle-age').value;
        const vehicleDamage = document.getElementById('pred-damage').value;
        
        // Use training data for standardization (if available)
        let standardizedAge = age;
        let standardizedPremium = annualPremium;
        let standardizedVintage = vintage;
        
        if (trainData && trainData.length > 0) {
            const trainAges = trainData.map(r => r.Age).filter(a => a !== null && !isNaN(a));
            const trainPremiums = trainData.map(r => r.Annual_Premium).filter(p => p !== null && !isNaN(p));
            const trainVintages = trainData.map(r => r.Vintage).filter(v => v !== null && !isNaN(v));
            
            standardizedAge = (age - calculateMean(trainAges)) / (calculateStdDev(trainAges) || 1);
            standardizedPremium = (annualPremium - calculateMean(trainPremiums)) / (calculateStdDev(trainPremiums) || 1);
            standardizedVintage = (vintage - calculateMean(trainVintages)) / (calculateStdDev(trainVintages) || 1);
        }
        
        // Start with numerical features
        let features = [
            isNaN(standardizedAge) ? 0 : standardizedAge,
            isNaN(standardizedPremium) ? 0 : standardizedPremium,
            0, // Region_Code (default)
            0, // Policy_Sales_Channel (default)
            isNaN(standardizedVintage) ? 0 : standardizedVintage
        ];
        
        // One-hot encoding for categorical features
        const genderOneHot = oneHotEncode(gender, ['Male', 'Female']);
        const drivingLicenseOneHot = oneHotEncode(drivingLicense, ['1', '0']);
        const previouslyInsuredOneHot = oneHotEncode(previouslyInsured, ['1', '0']);
        const vehicleAgeOneHot = oneHotEncode(vehicleAge, ['< 1 Year', '1-2 Year', '> 2 Years']);
        const vehicleDamageOneHot = oneHotEncode(vehicleDamage, ['Yes', 'No']);
        
        // Combine all features
        const allFeatures = features.concat(
            genderOneHot, 
            drivingLicenseOneHot, 
            previouslyInsuredOneHot, 
            vehicleAgeOneHot, 
            vehicleDamageOneHot
        );
        
        // Make prediction
        const inputTensor = tf.tensor2d([allFeatures]);
        const prediction = trainedModel.predict(inputTensor);
        const probability = (await prediction.data())[0];
        
        // Show result
        const resultDiv = document.getElementById('single-result');
        const threshold = parseFloat(document.getElementById('threshold-slider')?.value || 0.5);
        const isInterested = probability >= threshold;
        
        resultDiv.style.display = 'block';
        resultDiv.style.background = isInterested ? '#d4edda' : '#f8d7da';
        resultDiv.style.color = isInterested ? '#155724' : '#721c24';
        resultDiv.style.borderLeft = isInterested ? '4px solid #28a745' : '4px solid #dc3545';
        
        resultDiv.innerHTML = `
            <h4>🎯 Prediction Result</h4>
            <p><strong>Interest Probability:</strong> <span style="font-size: 1.2em; font-weight: bold;">${(probability * 100).toFixed(1)}%</span></p>
            <p><strong>Prediction:</strong> <span style="font-size: 1.1em; font-weight: bold;">${isInterested ? '✅ INTERESTED' : '❌ NOT INTERESTED'}</span></p>
            <p><strong>Confidence Level:</strong> ${probability >= 0.7 ? 'High' : probability >= 0.4 ? 'Medium' : 'Low'}</p>
            <p><strong>Recommended Action:</strong> ${isInterested ? 
                '🎯 Prioritize for targeted marketing campaign' : 
                '📧 Include in general communication'}</p>
            ${isInterested ? '<p><em>This customer shows strong interest in vehicle insurance</em></p>' : 
                            '<p><em>Consider other insurance products for this customer</em></p>'}
        `;
        
        // Clean up tensors
        inputTensor.dispose();
        prediction.dispose();
        
    } catch (error) {
        console.error('Error in single prediction:', error);
        const resultDiv = document.getElementById('single-result');
        resultDiv.style.display = 'block';
        resultDiv.style.background = '#fff5f5';
        resultDiv.style.color = '#721c24';
        resultDiv.innerHTML = `
            <h4>❌ Prediction Error</h4>
            <p>Error making prediction: ${error.message}</p>
            <p>Please ensure the model is properly trained in ML Specialist mode.</p>
        `;
    }
}

// Update inspectData to include business insights
const originalInspectData = inspectData;
inspectData = function() {
    originalInspectData.call(this);
    generateBusinessInsights();
};

// Update trainModel to save the trained model
const originalTrainModel = trainModel;
trainModel = async function() {
    await originalTrainModel.call(this);
    trainedModel = model;
    updateModelStatus();
    console.log('Model saved for business predictions');
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('Health Insurance Prediction App initialized');
    updateModelStatus();
    
    // Close visor on page load
    if (tfvis.visor().isOpen()) {
        tfvis.visor().close();
    }
});

