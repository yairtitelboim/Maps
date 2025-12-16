# Whitney Lake Water Surface Elevation Data Fetcher

This Python script fetches water surface elevation data for Whitney Lake from the USACE CWMS API and displays a timeline graph for the last 3 years.

## Features

- Fetches hourly water surface elevation data from the USACE CWMS API
- Displays data for the last 3 years
- Creates an interactive timeline graph with statistics
- Handles API rate limiting and data quality filtering
- Provides summary statistics

## Installation

1. Install required packages:
```bash
pip install -r requirements.txt
```

## Usage

Run the script:
```bash
python whitney_lake_elevation.py
```

## Data Source

- **API**: USACE CWMS Data API
- **Location**: Whitney Lake (WTYT2) in SWF office
- **Series**: WTYT2.Elev.Inst.1Hour.0.Decodes-Rev
- **Units**: Feet
- **Frequency**: Hourly

## Output

The script will:
1. Fetch elevation data for the last 3 years
2. Display a timeline graph showing water surface elevation over time
3. Show summary statistics including mean, min, max elevation
4. Display the total number of data points

## API Endpoint

The script uses the following API endpoint:
```
https://cwms-data.usace.army.mil/cwms-data/timeseries?office=SWF&name=WTYT2.Elev.Inst.1Hour.0.Decodes-Rev&begin=YYYY-MM-DDTHH:MM:SSZ&end=YYYY-MM-DDTHH:MM:SSZ
```

## Requirements

- Python 3.7+
- Internet connection
- Required packages: requests, pandas, matplotlib, numpy
