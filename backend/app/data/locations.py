"""Country-aware location data for case forms."""

# Kenya counties by region (simplified)
KE_REGIONS = ["Nairobi", "Central", "Coast", "Eastern", "North Eastern", "Nyanza", "Rift Valley", "Western"]
KE_COUNTIES = {
    "Nairobi": ["Dagoretti", "Embakasi", "Kamukunji", "Kasarani", "Kibra", "Langata", "Makadara", "Roysambu", "Ruaraka", "Starehe", "Westlands"],
    "Central": ["Kiambu", "Kirinyaga", "Murang'a", "Nyandarua", "Nyeri"],
    "Coast": ["Kilifi", "Kwale", "Lamu", "Mombasa", "Taita-Taveta", "Tana River"],
    "Eastern": ["Embu", "Isiolo", "Kitui", "Machakos", "Makueni", "Marsabit", "Tharaka-Nithi"],
    "North Eastern": ["Garissa", "Mandera", "Wajir"],
    "Nyanza": ["Homa Bay", "Kisii", "Kisumu", "Migori", "Nyamira", "Siaya"],
    "Rift Valley": ["Baringo", "Bomet", "Elgeyo-Marakwet", "Kajiado", "Kericho", "Laikipia", "Nakuru", "Nandi", "Narok", "Samburu", "Trans Nzoia", "Turkana", "Uasin Gishu", "West Pokot"],
    "Western": ["Bungoma", "Busia", "Kakamega", "Vihiga"],
}

# Nigeria states by zone
NG_ZONES = ["North Central", "North East", "North West", "South East", "South South", "South West"]
NG_STATES = {
    "North Central": ["Benue", "FCT", "Kogi", "Kwara", "Nasarawa", "Niger", "Plateau"],
    "North East": ["Adamawa", "Bauchi", "Borno", "Gombe", "Taraba", "Yobe"],
    "North West": ["Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Sokoto", "Zamfara"],
    "South East": ["Abia", "Anambra", "Ebonyi", "Enugu", "Imo"],
    "South South": ["Akwa Ibom", "Bayelsa", "Cross River", "Delta", "Edo", "Rivers"],
    "South West": ["Ekiti", "Lagos", "Ogun", "Ondo", "Osun", "Oyo"],
}

# South Africa provinces
ZA_PROVINCES = ["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "Northern Cape", "North West", "Western Cape"]

LOCATIONS = {
    "KE": {"region_label": "Region", "sub_label": "County", "regions": KE_REGIONS, "sub_regions": KE_COUNTIES},
    "NG": {"region_label": "Zone", "sub_label": "State", "regions": NG_ZONES, "sub_regions": NG_STATES},
    "ZA": {"region_label": "Province", "sub_label": None, "regions": ZA_PROVINCES, "sub_regions": {}},
}

# Default for other countries
DEFAULT = {"region_label": "Region", "sub_label": "Sub-region", "regions": [], "sub_regions": {}}
