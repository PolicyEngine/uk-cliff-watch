from __future__ import annotations

DEFAULT_YEAR = 2026
DEFAULT_SERIES_MAX_EARNINGS = 80_000
DEFAULT_SERIES_STEP = 500
DEFAULT_CLIFF_DELTA = 1_000
DEFAULT_SERIES_EARNINGS_BUFFER = 20_000
DEFAULT_SERIES_MIN_EARNINGS_WINDOW = 60_000
DEFAULT_SERIES_TARGET_POINTS = 161
DEFAULT_SERIES_STEP_INCREMENT = 250
MAX_ADULTS = 2
MAX_DEPENDENTS = 6

# UK ITL1 regions, matching the policyengine_uk `region` enum (excluding UNKNOWN).
REGION_INFO = [
    {"code": "NORTH_EAST", "name": "North East"},
    {"code": "NORTH_WEST", "name": "North West"},
    {"code": "YORKSHIRE", "name": "Yorkshire and the Humber"},
    {"code": "EAST_MIDLANDS", "name": "East Midlands"},
    {"code": "WEST_MIDLANDS", "name": "West Midlands"},
    {"code": "EAST_OF_ENGLAND", "name": "East of England"},
    {"code": "LONDON", "name": "London"},
    {"code": "SOUTH_EAST", "name": "South East"},
    {"code": "SOUTH_WEST", "name": "South West"},
    {"code": "WALES", "name": "Wales"},
    {"code": "SCOTLAND", "name": "Scotland"},
    {"code": "NORTHERN_IRELAND", "name": "Northern Ireland"},
]
REGION_NAME_BY_CODE = {item["code"]: item["name"] for item in REGION_INFO}

# Benefit (support) components summed into household support.
# Each maps a policyengine-uk variable to the household entity.
BENEFIT_COMPONENTS = [
    {
        "key": "universal_credit",
        "variable": "universal_credit",
        "label": "Universal Credit",
        "short_label": "UC",
        "description": "Means-tested Universal Credit award (55% taper above the work allowance).",
    },
    {
        "key": "child_benefit",
        "variable": "child_benefit",
        "label": "Child Benefit",
        "short_label": "Child Benefit",
        "description": "Child Benefit, clawed back by the High-Income Child Benefit Charge above £60k.",
    },
    {
        "key": "child_tax_credit",
        "variable": "child_tax_credit",
        "label": "Child Tax Credit",
        "short_label": "CTC",
        "description": "Legacy Child Tax Credit (being replaced by Universal Credit).",
    },
    {
        "key": "working_tax_credit",
        "variable": "working_tax_credit",
        "label": "Working Tax Credit",
        "short_label": "WTC",
        "description": "Legacy Working Tax Credit (being replaced by Universal Credit).",
    },
    {
        "key": "housing_benefit",
        "variable": "housing_benefit",
        "label": "Housing Benefit",
        "short_label": "Housing Benefit",
        "description": "Legacy Housing Benefit for renters not on Universal Credit.",
    },
    {
        "key": "council_tax_benefit",
        "variable": "council_tax_benefit",
        "label": "Council Tax Reduction",
        "short_label": "CTR",
        "description": "Locally-administered Council Tax Reduction / Support.",
    },
    {
        "key": "pension_credit",
        "variable": "pension_credit",
        "label": "Pension Credit",
        "short_label": "Pension Credit",
        "description": "Means-tested top-up for pensioners on low incomes.",
    },
    {
        "key": "tax_free_childcare",
        "variable": "tax_free_childcare",
        "label": "Tax-Free Childcare",
        "short_label": "TFC",
        "description": "Government childcare top-up, withdrawn entirely above £100k (a hard cliff).",
    },
    {
        "key": "free_school_meals",
        "variable": "free_school_meals",
        "label": "Free School Meals",
        "short_label": "FSM",
        "description": "Value of free school meals for eligible children.",
    },
]

# Tax components subtracted from market income + support.
TAX_COMPONENTS = [
    {
        "key": "income_tax",
        "variable": "income_tax",
        "label": "Income Tax",
        "short_label": "Income Tax",
        "description": "Income tax, including the 60% personal-allowance taper between £100k and £125,140.",
    },
    {
        "key": "national_insurance",
        "variable": "national_insurance",
        "label": "National Insurance",
        "short_label": "NI",
        "description": "Employee Class 1 National Insurance contributions.",
    },
    {
        "key": "council_tax",
        "variable": "council_tax",
        "label": "Council Tax",
        "short_label": "Council Tax",
        "description": "Council Tax net of any reduction.",
    },
]

PROGRAM_DEFINITIONS = BENEFIT_COMPONENTS  # exposed in metadata for the breakdown UI

# Canonical UK household templates for the comparison panel.
HOUSEHOLD_TYPES = [
    {
        "id": "single_no_children",
        "label": "Single adult, no children",
        "short_label": "Single",
        "description": "One working-age adult.",
        "summary": "A single working-age adult with no dependants.",
        "people": [{"role": "adult", "age": 30}],
    },
    {
        "id": "lone_parent_2",
        "label": "Lone parent, 2 children",
        "short_label": "Lone parent +2",
        "description": "One adult with two children (ages 4 and 7).",
        "summary": "A lone parent with two young children — the classic Universal Credit taper case.",
        "people": [
            {"role": "adult", "age": 35},
            {"role": "dependent", "age": 4},
            {"role": "dependent", "age": 7},
        ],
    },
    {
        "id": "couple_2",
        "label": "Couple, 2 children",
        "short_label": "Couple +2",
        "description": "Two adults with two children (ages 4 and 7).",
        "summary": "A couple with two children; the first adult is the primary earner.",
        "people": [
            {"role": "adult", "age": 35},
            {"role": "adult", "age": 35},
            {"role": "dependent", "age": 4},
            {"role": "dependent", "age": 7},
        ],
    },
    {
        "id": "couple_no_children",
        "label": "Couple, no children",
        "short_label": "Couple",
        "description": "Two working-age adults.",
        "summary": "A couple with no dependants; the first adult is the primary earner.",
        "people": [
            {"role": "adult", "age": 35},
            {"role": "adult", "age": 35},
        ],
    },
]
HOUSEHOLD_TYPE_BY_ID = {item["id"]: item for item in HOUSEHOLD_TYPES}
