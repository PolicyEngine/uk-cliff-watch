from __future__ import annotations

DEFAULT_YEAR = 2026
# Sweep to £120k (covers the onset of the £100k personal-allowance trap).
DEFAULT_SERIES_MAX_EARNINGS = 120_000
DEFAULT_SERIES_STEP = 500
DEFAULT_CLIFF_DELTA = 1_000
DEFAULT_SERIES_EARNINGS_BUFFER = 20_000
DEFAULT_SERIES_MIN_EARNINGS_WINDOW = 80_000
DEFAULT_SERIES_TARGET_POINTS = 281
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
        "key": "extended_childcare_entitlement",
        "variable": "extended_childcare_entitlement",
        "label": "Free childcare hours",
        "short_label": "Free hours",
        "description": "15/30 hours of funded childcare; withdrawn entirely above £100k income.",
    },
    {
        "key": "free_school_meals",
        "variable": "free_school_meals",
        "label": "Free School Meals",
        "short_label": "FSM",
        "description": "Value of free school meals for eligible children.",
    },
    {
        "key": "carers_allowance",
        "variable": "carers_allowance",
        "label": "Carer's Allowance",
        "short_label": "CA",
        "description": (
            "Carer's Allowance (~£83.30/week, £4,331/yr) — paid when the carer "
            "provides ≥35 hours of unpaid care.  Abolished entirely if the carer's "
            "net earnings exceed £196/week (£10,192/yr): a hard cliff."
        ),
    },
    {
        "key": "uc_carer_element",
        "variable": "uc_carer_element",
        "label": "UC carer element",
        "short_label": "UC carer",
        "description": (
            "Universal Credit carer element (~£2,901/yr in 2025/26), added to the UC "
            "award when the claimant is entitled to Carer's Allowance.  Unlike CA "
            "itself this element tapers away gradually with the UC earnings taper."
        ),
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


# One-click scenarios for the dashboard. Each `payload` is a ready-to-send
# HouseholdPayload that seeds every control at once.
PRESETS = [
    {
        "id": "uc_taper",
        "label": "Universal Credit taper",
        "tagline": "Lone parent, 2 children, renting",
        "description": (
            "A lone parent with two young children renting in the North West. The "
            "Universal Credit 55% taper stacks on Income Tax and National Insurance "
            "to create a flat ~68% marginal-rate wall across most of the earnings range."
        ),
        "payload": {
            "region": "NORTH_WEST",
            "earned_income": 0,
            "rent_annual": 9000,
            "childcare_expenses_annual": 0,
            "is_renting": True,
            "people": [
                {"kind": "adult", "age": 35},
                {"kind": "child", "age": 4},
                {"kind": "child", "age": 7},
            ],
        },
    },
    {
        "id": "hundred_k_trap",
        "label": "The £100k trap",
        "tagline": "Single earner, 2 children",
        "description": (
            "A single earner with two school-age children. Watch the marginal rate "
            "jump to ~54% as Child Benefit is clawed back above £60k, then to ~62% in "
            "the £100,000–£125,140 personal-allowance trap where the tax-free allowance "
            "is withdrawn."
        ),
        "payload": {
            "region": "SOUTH_EAST",
            "earned_income": 100000,
            "rent_annual": 0,
            "childcare_expenses_annual": 0,
            "is_renting": False,
            "people": [
                {"kind": "adult", "age": 40},
                {"kind": "child", "age": 8},
                {"kind": "child", "age": 11},
            ],
        },
    },
    {
        "id": "childcare_cliff",
        "label": "The £100k childcare cliff",
        "tagline": "One earner, young child, nursery fees",
        "description": (
            "A single earner with a nursery-age child and childcare costs. At "
            "£100,000 of income the family loses Tax-Free Childcare and the 15/30 "
            "free hours outright — a genuine cliff where net income falls as pay "
            "rises. This is one of the few hard cliffs on the UK earnings axis."
        ),
        "payload": {
            "region": "LONDON",
            "earned_income": 95000,
            "rent_annual": 0,
            "childcare_expenses_annual": 12000,
            "is_renting": False,
            "people": [
                {"kind": "adult", "age": 38},
                {"kind": "child", "age": 3},
            ],
        },
    },
    {
        "id": "couple_2_kids",
        "label": "Couple, 2 children",
        "tagline": "One earner, renting",
        "description": (
            "A couple with two children, one primary earner, renting in the North "
            "West — the household type most exposed to the Universal Credit taper."
        ),
        "payload": {
            "region": "NORTH_WEST",
            "earned_income": 30000,
            "rent_annual": 9000,
            "childcare_expenses_annual": 0,
            "is_renting": True,
            "people": [
                {"kind": "adult", "age": 35},
                {"kind": "adult", "age": 35},
                {"kind": "child", "age": 4},
                {"kind": "child", "age": 7},
            ],
        },
    },
    {
        "id": "single_no_kids",
        "label": "Single adult",
        "tagline": "No children, renting",
        "description": (
            "A single working-age adult with no children, renting — the baseline "
            "case with a much smaller benefit footprint."
        ),
        "payload": {
            "region": "NORTH_WEST",
            "earned_income": 20000,
            "rent_annual": 7200,
            "childcare_expenses_annual": 0,
            "is_renting": True,
            "people": [
                {"kind": "adult", "age": 30},
            ],
        },
    },
    {
        "id": "carers_allowance_cliff",
        "label": "Carer's Allowance cliff",
        "tagline": "Single carer, 35+ hrs/week, modest rent",
        "description": (
            "A single adult providing 35+ hours of unpaid care, renting in the "
            "North West.  Carer's Allowance (~£4,331/yr) is cut to zero the "
            "moment net earnings exceed £196/week (£10,192/yr) — one of the "
            "sharpest hard cliffs in the UK benefit system."
        ),
        "payload": {
            "region": "NORTH_WEST",
            "earned_income": 8000,
            "rent_annual": 7200,
            "childcare_expenses_annual": 0,
            "is_renting": True,
            "people": [
                {"kind": "adult", "age": 40, "is_carer": True, "care_hours": 35},
            ],
        },
    },
]
