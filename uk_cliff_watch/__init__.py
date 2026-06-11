"""UK benefit-cliff calculator built on policyengine-uk."""

__all__ = [
    "HouseholdInput",
    "HouseholdMemberInput",
    "calculate_household",
    "calculate_household_types",
    "calculate_income_series",
    "calculate_region_comparison",
    "household_input_from_dict",
]


def __getattr__(name):
    if name not in __all__:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

    from importlib import import_module

    calculator = import_module("uk_cliff_watch.calculator")
    return getattr(calculator, name)
