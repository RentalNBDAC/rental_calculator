from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
from datetime import datetime

# uvicorn main:app --reload

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables
df = None
all_property_types = []
location_tree = {}

@app.on_event("startup")
def load_data():
    global df, all_property_types, location_tree
    print("Loading data... please wait...")
    
    # 1. LOAD DATA
    #df = pd.read_csv("/Users/akmalhakim/Downloads/National Big Data Analytic Centre/rental-calc/backend/rental_data.csv", low_memory=False) 
    df = pd.read_csv("/Users/akmalhakim/Downloads/National Big Data Analytic Centre/rental-calc/backend/rental_data_2026_with_coords.csv", low_memory=False) 
    
    # 2. CLEANING
    # Ensure Price is numeric
    df['Rent Price'] = pd.to_numeric(df['Rent Price'], errors='coerce')
    
    # Clean string columns
    df['State'] = df['State'].astype(str).str.strip()
    df['District'] = df['District'].astype(str).str.strip()
    df['Standard Type'] = df['Standard Type'].astype(str).str.strip()
    
    # IMPORTANT: We ONLY drop rows if they don't have Price, State, District, or Type.
    # We DO NOT drop rows missing Latitude/Longitude yet.
    df.dropna(subset=['Rent Price', 'State', 'District', 'Standard Type'], inplace=True)
    
    # 3. GENERATE SMART OPTIONS
    print("Building location tree...")
    all_property_types = sorted(df['Standard Type'].unique().tolist())
    
    # Build tree
    grouped = df.groupby(['State', 'District'])['Standard Type'].unique()
    location_tree = {}
    
    for (state, district), types in grouped.items():
        if state not in location_tree:
            location_tree[state] = {}
        location_tree[state][district] = sorted(types.tolist())

    print(f"✅ Data Loaded! {len(df)} total rows.")

@app.get("/options")
def get_form_options():
    return {
        "all_types": all_property_types,
        "location_tree": location_tree
    }

@app.get("/search")
def search_rentals(state: str, district: str, houseType: str):
    if df is None:
        return {"found": False, "error": "Data not loaded"}

    # 1. BASE FILTER (Calculator Data)
    mask = (
        (df['State'] == state) & 
        (df['District'] == district) & 
        (df['Standard Type'] == houseType)
    )
    all_results = df[mask]
    
    if all_results.empty:
        return {"found": False}
    
    # 2. STATS & FEATURES
    median_rent = int(all_results['Rent Price'].median())
    total_listings = len(all_results)
    
    features = []
    if 'Furnishing Type' in all_results.columns:
        mode = all_results['Furnishing Type'].mode()
        if not mode.empty: features.append(str(mode[0]))
    if 'Property Size' in all_results.columns:
         med_size = all_results['Property Size'].median()
         if not pd.isna(med_size): features.append(f"{int(med_size)} sqft")
    if 'No of Bedroom' in all_results.columns:
        mode_bed = all_results['No of Bedroom'].mode()
        if not mode_bed.empty: features.append(f"{int(float(mode_bed[0]))} Beds")
    if 'No of Bathroom' in all_results.columns:
        mode_bath = all_results['No of Bathroom'].mode()
        if not mode_bath.empty: features.append(f"{int(float(mode_bath[0]))} Baths")

    # 3. COMPARISON LOGIC
    district_mask = (df['State'] == state) & (df['District'] == district)
    district_df = df[district_mask]
    comparison_data = district_df.groupby('Standard Type')['Rent Price'].median().reset_index()
    comparison_list = []
    for _, row in comparison_data.iterrows():
        t_type = row['Standard Type']
        t_price = int(row['Rent Price'])
        if t_type != houseType:
            comparison_list.append({
                "type": t_type,
                "medianRent": t_price,
                "diff": t_price - median_rent
            })
    comparison_list.sort(key=lambda x: x['medianRent'])

    # 4. CHARTS (Trends & Distribution)
    trend_data = []
    if 'Extract Date' in all_results.columns:
        trend_df = all_results.copy()
        trend_df['date'] = pd.to_datetime(trend_df['Extract Date'], errors='coerce')
        trend_df.dropna(subset=['date'], inplace=True)
        trend_df['month_year'] = trend_df['date'].dt.to_period('D').astype(str)
        monthly_stats = trend_df.groupby('month_year')['Rent Price'].median().reset_index().sort_values('month_year')
        for _, row in monthly_stats.iterrows():
            trend_data.append({"name": row['month_year'], "price": int(row['Rent Price'])})

    prices = all_results['Rent Price'].dropna()
    bins = range(0, int(prices.max()) + 500, 500)
    labels = [f"{i}-{i+500}" for i in bins[:-1]]
    price_dist = pd.cut(prices, bins=bins, labels=labels, right=False).value_counts().sort_index()
    distribution_data = [{"range": k, "count": v} for k, v in price_dist.items() if v > 0]

    # 5. MAP DATA (With Price Coloring)
    map_results = all_results.dropna(subset=['Latitude', 'Longitude'])
    points = []
    center_lat, center_lng = 3.1319, 101.6841
    map_min = 0
    map_max = 0

    if not map_results.empty:
        center_lat = map_results['Latitude'].mean()
        center_lng = map_results['Longitude'].mean()
        
        # Calculate min/max for color scaling
        map_min = int(map_results['Rent Price'].min())
        map_max = int(map_results['Rent Price'].max())

        if len(map_results) > 2000:
            map_results = map_results.sample(n=2000)
            
        # Return [Lat, Lng, Price]
        points = map_results[['Latitude', 'Longitude', 'Rent Price']].values.tolist()

    return {
        "found": True,
        "location": f"{district}, {state}",
        "medianRent": median_rent,
        "suitableIncome": median_rent * 3,
        "coordinates": [center_lat, center_lng],
        "points": points,
        "mapMin": map_min, # New
        "mapMax": map_max, # New
        "commonFeatures": features,
        "count": len(all_results),
        "comparison": comparison_list,
        "trends": trend_data,
        "distribution": distribution_data
    }
