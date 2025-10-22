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
        
        mlSections.forEach(section => {
            const card = Array.from(document.querySelectorAll('.card')).find(card => {
                const cardTitle = card.querySelector('h2');
                return cardTitle && cardTitle.textContent.includes(section);
            });
            if (card) card.style.display = 'block';
        });
        
        document.getElementById('ml-mode-btn').style.background = 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)';
        document.getElementById('business-mode-btn').style.background = '#6c757d';
        document.getElementById('mode-indicator').textContent = 'Current Mode: ML Specialist';
        document.getElementById('mode-indicator').style.color = '#007bff';
    } else {
        // Business User Mode - show ONLY business sections in правильном порядке
        const businessSections = [
            'Business Prediction',  // Первый
            'Single Customer Prediction',  // Второй  
            'Business Insights'  // Третий
        ];
        
        businessSections.forEach(section => {
            const card = Array.from(document.querySelectorAll('.card')).find(card => {
                const cardTitle = card.querySelector('h2');
                return cardTitle && cardTitle.textContent.includes(section);
            });
            if (card) card.style.display = 'block';
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
    
    // Generate business insights for ML mode too
    generateBusinessInsights();
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
// Create business visualizations - РАЗНОЦВЕТНЫЕ ГРАФИКИ
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
            { index: 'Male', value: genderData.Male ? (genderData.Male.interested / genderData.Male.total) * 100 : 0 },
            { index: 'Female', value: genderData.Female ? (genderData.Female.interested / genderData.Female.total) * 100 : 0 }
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
        
        const damageChartData = [
            { index: 'With Damage', value: damageData['Yes'] ? (damageData['Yes'].interested / damageData['Yes'].total) * 100 : 0 },
            { index: 'No Damage', value: damageData['No'] ? (damageData['No'].interested / damageData['No'].total) * 100 : 0 }
        ];
        
        // Premium distribution
        const premiums = trainData.map(row => row.Annual_Premium).filter(p => p && !isNaN(p));
        const premiumRanges = [
            { range: '0-20k', min: 0, max: 20000, color: '#4CAF50' },
            { range: '20k-40k', min: 20000, max: 40000, color: '#2196F3' },
            { range: '40k-60k', min: 40000, max: 60000, color: '#FF9800' },
            { range: '60k+', min: 60000, max: Infinity, color: '#F44336' }
        ];
        
        const premiumChartData = premiumRanges.map(range => ({
            index: range.range,
            value: premiums.filter(p => p >= range.min && p < range.max).length,
            color: range.color
        }));
        
        vizContainer.innerHTML += `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
                <div style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h4>🎭 Interest Rate by Gender</h4>
                    <div id="gender-chart" style="height: 250px;"></div>
                </div>
                <div style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h4>📅 Customer Age Distribution</h4>
                    <div id="age-chart" style="height: 250px;"></div>
                </div>
                <div style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h4>🚗 Interest by Vehicle Damage</h4>
                    <div id="damage-chart" style="height: 250px;"></div>
                </div>
                <div style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h4>💰 Premium Distribution</h4>
                    <div id="premium-chart" style="height: 250px;"></div>
                </div>
            </div>
        `;
        
        // Render charts with colors
        setTimeout(() => {
            try {
                // Gender chart - разные цвета
                tfvis.render.barchart(
                    document.getElementById('gender-chart'),
                    genderChartData,
                    { 
                        xLabel: 'Gender', 
                        yLabel: 'Interest Rate (%)',
                        yAxisDomain: [0, 100],
                        color: ['#FF6B6B', '#4ECDC4'] // Красный и бирюзовый
                    }
                );
                
                // Age chart - градиент цветов
                tfvis.render.barchart(
                    document.getElementById('age-chart'),
                    ageChartData,
                    { 
                        xLabel: 'Age Group', 
                        yLabel: 'Number of Customers',
                        color: ['#FF9FF3', '#F368E0', '#FF6B6B', '#EE5A24', '#C4E538'] // Розовые и оранжевые
                    }
                );
                
                // Damage chart - контрастные цвета
                tfvis.render.barchart(
                    document.getElementById('damage-chart'),
                    damageChartData,
                    { 
                        xLabel: 'Vehicle Damage', 
                        yLabel: 'Interest Rate (%)',
                        yAxisDomain: [0, 100],
                        color: ['#FF9FF3', '#54A0FF'] // Розовый и синий
                    }
                );
                
                // Premium chart - цвета из данных
                const premiumColors = premiumChartData.map(item => item.color);
                const premiumValues = premiumChartData.map(item => ({
                    index: item.index,
                    value: item.value
                }));
                
                tfvis.render.barchart(
                    document.getElementById('premium-chart'),
                    premiumValues,
                    { 
                        xLabel: 'Premium Range (₹)', 
                        yLabel: 'Number of Customers',
                        color: premiumColors // Зеленый, синий, оранжевый, красный
                    }
                );
                
            } catch (error) {
                console.error('Error rendering charts:', error);
                vizContainer.innerHTML += `<p style="color: red;">Error rendering charts: ${error.message}</p>`;
            }
        }, 500);
        
    } catch (error) {
        console.error('Error creating business visualizations:', error);
        vizContainer.innerHTML += `<p style="color: red;">Error creating visualizations: ${error.message}</p>`;
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

// ========== ML SPECIALIST FUNCTIONS ==========

// Preprocess the data - OPTIMIZED VERSION
// Preprocess the data - FIXED VERSION
// Preprocess the data - FIXED VERSION
function preprocessData() {
    if (!trainData || !testData) {
        alert('Please load data first.');
        return;
    }
    
    const outputDiv = document.getElementById('preprocessing-output');
    if (!outputDiv) {
        console.error('preprocessing-output element not found');
        alert('UI element error: preprocessing-output not found');
        return;
    }
    
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
            }
            
            console.log('Converting to tensors...');

            // Convert to tensors
            preprocessedTrainData.features = tf.tensor2d(preprocessedTrainData.features);
            preprocessedTrainData.labels = tf.tensor1d(preprocessedTrainData.labels);
            
            console.log('Preprocessing completed successfully');
            console.log('Training features shape:', preprocessedTrainData.features.shape);
            console.log('Test features count:', preprocessedTestData.features.length);
            
            if (outputDiv) {
                outputDiv.innerHTML = `
                    <div style="color: green;">
                        <p><strong>Preprocessing completed!</strong></p>
                        <p>Training features shape: ${preprocessedTrainData.features.shape}</p>
                        <p>Training labels shape: ${preprocessedTrainData.labels.shape}</p>
                        <p>Test features shape: [${preprocessedTestData.features.length}, ${preprocessedTestData.features[0] ? preprocessedTestData.features[0].length : 0}]</p>
                    </div>
                `;
            }
            
            // FIXED: Safe element check for create-model-btn
            const createModelBtn = document.getElementById('create-model-btn');
            if (createModelBtn) {
                createModelBtn.disabled = false;
                console.log('Create Model button enabled');
            } else {
                console.warn('create-model-btn element not found - button not enabled');
            }
            
        } catch (error) {
            console.error('Error during preprocessing:', error);
            if (outputDiv) {
                outputDiv.innerHTML = `<div style="color: red;">
                    <p><strong>Error during preprocessing:</strong></p>
                    <p>${error.message}</p>
                    <p>Check console for details</p>
                </div>`;
            }
        }
    }, 100);
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
    
    // Add engineered features
    const youngRiskyDriver = (age < 30 && row.Vehicle_Damage === 'Yes') ? 1 : 0;
    features.push(youngRiskyDriver);
    
    const lapsedCustomer = (row.Previously_Insured === 1 && row.Vehicle_Damage === 'Yes') ? 1 : 0;
    features.push(lapsedCustomer);
    
    // Premium segments
    const premiumSegment = annualPremium < 20000 ? 0 : annualPremium < 50000 ? 1 : 2;
    const premiumSegmentOneHot = oneHotEncode(premiumSegment.toString(), ['0', '1', '2']);
    features = features.concat(premiumSegmentOneHot);
    
    return features;
}

// Create the model
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

// Train the model
// Train the model (ИСПРАВЛЕННАЯ ВЕРСИЯ)
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
        
        const epochs = parseInt(document.getElementById('epochs').value) || 50;
        
        // Class weights
        const labelsArray = await trainLabels.data();
        const positiveCount = labelsArray.filter(label => label === 1).length;
        const negativeCount = labelsArray.length - positiveCount;
        
        const positiveWeight = Math.min(negativeCount / positiveCount, 3);
        
        const classWeight = { 
            0: 1, 
            1: positiveWeight
        };

        // 🔥 EARLY STOPPING VARIABLES
        let bestValLoss = Infinity;
        let patience = 5;
        let patienceCounter = 0;
        let bestWeights = null;

        trainingHistory = await model.fit(trainFeatures, trainLabels, {
            epochs: epochs,
            batchSize: 32,
            validationData: [valFeatures, valLabels],
            classWeight: classWeight,
            callbacks: {
                onEpochBegin: async (epoch, logs) => {
                    if (epoch === 0) {
                        bestWeights = model.getWeights();
                    }
                },
                onEpochEnd: async (epoch, logs) => {
                    const status = `Epoch ${epoch + 1}/${epochs} - loss: ${logs.loss.toFixed(4)}, acc: ${logs.acc.toFixed(4)}, val_loss: ${logs.val_loss.toFixed(4)}, val_acc: ${logs.val_acc.toFixed(4)}`;
                    
                    // 🔥 EARLY STOPPING LOGIC
                    if (logs.val_loss < bestValLoss) {
                        bestValLoss = logs.val_loss;
                        patienceCounter = 0;
                        bestWeights = model.getWeights();
                        statusDiv.innerHTML = status + ' ✅ (Best val_loss)';
                    } else {
                        patienceCounter++;
                        statusDiv.innerHTML = status + ` ⚠️ (Patience: ${patienceCounter}/${patience})`;
                        
                        if (patienceCounter >= patience) {
                            console.log(`Early stopping triggered at epoch ${epoch + 1}`);
                            model.stopTraining = true;
                            
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
                    
                    // Save the trained model for business mode
                    trainedModel = model;
                    updateModelStatus();
                    
                    // Make validation predictions for evaluation
                    setTimeout(async () => {
                        try {
                            validationPredictions = model.predict(validationData);
                            
                            // Enable interactive evaluation
                            document.getElementById('threshold-slider').disabled = false;
                            document.getElementById('threshold-slider').addEventListener('input', updateMetrics);
                            
                            // Find optimal threshold and update metrics
                            const optimalThreshold = await findOptimalThreshold();
                            document.getElementById('threshold-slider').value = optimalThreshold;
                            await updateMetrics();
                            
                            // Enable prediction button
                            const predictBtn = document.getElementById('predict-btn');
                            if (predictBtn) {
                                predictBtn.disabled = false;
                            }
                            
                        } catch (error) {
                            console.error('Error in post-training setup:', error);
                        }
                    }, 500);
                }
            }
        });
        
    } catch (error) {
        console.error('Error during training:', error);
        statusDiv.innerHTML = `<p style="color: red;">Error during training: ${error.message}</p>`;
    }
}

// Find optimal threshold - НОВАЯ ФУНКЦИЯ
async function findOptimalThreshold() {
    if (!validationPredictions || !validationLabels) return 0.5;
    
    try {
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
        
    } catch (error) {
        console.error('Error finding optimal threshold:', error);
        return 0.5;
    }
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
        
        const specificity = tn / (tn + fp) || 0;
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
                <p><strong>Current Threshold:</strong> ${threshold.toFixed(2)}</p>
            </div>
        `;
        
        // Plot ROC curve
        await plotROC(trueVals, predVals);
        
    } catch (error) {
        console.error('Error updating enhanced metrics:', error);
    }
}

// Plot ROC curve - НОВАЯ ФУНКЦИЯ
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
            
            const tpr = tp / (tp + fn) || 0;
            const fpr = fp / (fp + tn) || 0;
            
            rocData.push({ threshold, fpr, tpr });
        });
        
        // AUC calculation
        let auc = 0;
        rocData.sort((a, b) => a.fpr - b.fpr);
        
        for (let i = 1; i < rocData.length; i++) {
            const width = rocData[i].fpr - rocData[i-1].fpr;
            const avgHeight = (rocData[i].tpr + rocData[i-1].tpr) / 2;
            auc += width * avgHeight;
        }
        
        console.log('AUC calculated:', auc);
        
        // Plot ROC curve
        if (auc >= 0 && auc <= 1) {
            const rocValues = rocData.map(d => ({ x: d.fpr, y: d.tpr }));
            
            tfvis.render.linechart(
                { name: 'ROC Curve', tab: 'Model Evaluation' },
                { values: rocValues },
                { 
                    xLabel: 'False Positive Rate', 
                    yLabel: 'True Positive Rate',
                    series: ['ROC Curve'],
                    width: 400,
                    height: 400
                }
            );
            
            // Add AUC to metrics
            const metricsDiv = document.getElementById('performance-metrics');
            if (metricsDiv) {
                metricsDiv.innerHTML = metricsDiv.innerHTML.replace(
                    '</div>', 
                    `<p><strong>AUC:</strong> ${auc.toFixed(4)}</p></div>`
                );
            }
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

// ========== HELPER FUNCTIONS ==========

function calculateMedian(values) {
    if (!values || values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const half = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
        return (sorted[half - 1] + sorted[half]) / 2;
    }
    
    return sorted[half];
}

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

async function evaluateModel() {
    if (!model || !validationData || !validationLabels) {
        alert('Please train the model first.');
        return;
    }
    
    const resultsDiv = document.getElementById('evaluation-results');
    resultsDiv.innerHTML = 'Evaluating model...';
    
    try {
        // Get predictions
        const predictions = model.predict(validationData);
        const predArray = await predictions.array();
        const labelsArray = await validationLabels.array();
        
        // Calculate metrics with default threshold
        const threshold = 0.5;
        let tp = 0, fp = 0, tn = 0, fn = 0;
        
        for (let i = 0; i < predArray.length; i++) {
            const prediction = predArray[i] >= threshold ? 1 : 0;
            const actual = labelsArray[i];
            
            if (prediction === 1 && actual === 1) tp++;
            else if (prediction === 1 && actual === 0) fp++;
            else if (prediction === 0 && actual === 0) tn++;
            else if (prediction === 0 && actual === 1) fn++;
        }
        
        const accuracy = (tp + tn) / (tp + tn + fp + fn);
        const precision = tp / (tp + fp) || 0;
        const recall = tp / (tp + fn) || 0;
        const f1 = 2 * (precision * recall) / (precision + recall) || 0;
        
        resultsDiv.innerHTML = `
            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px;">
                <h3>Model Evaluation Results</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
                    <div>
                        <h4>Performance Metrics</h4>
                        <p><strong>Accuracy:</strong> ${(accuracy * 100).toFixed(2)}%</p>
                        <p><strong>Precision:</strong> ${precision.toFixed(4)}</p>
                        <p><strong>Recall:</strong> ${recall.toFixed(4)}</p>
                        <p><strong>F1-Score:</strong> ${f1.toFixed(4)}</p>
                    </div>
                    <div>
                        <h4>Confusion Matrix</h4>
                        <table style="border-collapse: collapse; width: 100%;">
                            <tr>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: center; background: #e8f5e8;">TN: ${tn}</td>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: center; background: #ffe8e8;">FP: ${fp}</td>
                            </tr>
                            <tr>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: center; background: #ffe8e8;">FN: ${fn}</td>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: center; background: #e8f5e8;">TP: ${tp}</td>
                            </tr>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error during evaluation:', error);
        resultsDiv.innerHTML = `<div style="color: red;">Error during evaluation: ${error.message}</div>`;
    }
}

// Update metrics function (исправленная)
async function updateMetrics() {
    if (!validationPredictions || !validationLabels) return;
    
    try {
        const predVals = await validationPredictions.array();
        const trueVals = await validationLabels.array();
        
        // Use default threshold since slider doesn't exist
        const threshold = 0.5;
        
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
        const accuracy = (tp + tn) / (tp + tn + fp + fn) || 0;
        
        console.log('Model Performance:', {
            accuracy: (accuracy * 100).toFixed(2) + '%',
            precision: precision.toFixed(4),
            recall: recall.toFixed(4),
            f1: f1.toFixed(4)
        });
        
    } catch (error) {
        console.error('Error updating metrics:', error);
    }
}

// Predict function (исправленная)
async function predict() {
    if (!model || !preprocessedTestData) {
        alert('Please train model and ensure test data is loaded.');
        return;
    }
    
    const outputDiv = document.getElementById('prediction-results');
    outputDiv.innerHTML = 'Making predictions...';
    
    try {
        // Convert test features to tensor
        const testFeatures = tf.tensor2d(preprocessedTestData.features);
        
        // Make predictions
        const predictions = model.predict(testFeatures);
        const predValues = await predictions.array();
        
        // Create prediction results
        const threshold = 0.5; // Default threshold
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
        
        // Store predictions for export
        testPredictions = predictions;
        
        // Enable the export button
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) exportBtn.disabled = false;
        
    } catch (error) {
        console.error('Error during prediction:', error);
        outputDiv.innerHTML = `Error during prediction: ${error.message}`;
    }
}