import os
import base64

def validate_environment_variables():
    data_provider = os.getenv("DATA_PROVIDER")
    competition_scope = os.getenv("COMPETITION_SCOPE")
    logo = os.getenv("LOGO")
    subdomain = os.getenv("SUBDOMAIN")
    default_team = os.getenv("DEFAULT_TEAM")
    default_competition = os.getenv("DEFAULT_COMPETITION")
    default_season = os.getenv("DEFAULT_SEASON")

    valid_data_providers = ["wyscout", "statsbomb", "champion"]
    if data_provider not in valid_data_providers:
        raise ValueError(
            f"Invalid data_provider: {data_provider}. Must be one of {valid_data_providers}"
        )

    if not competition_scope:
        competition_scope = "all"

    valid_competition_scopes = [
        "all",
        "wyscout-mens",
        "wyscout-womens",
        "wyscout-youth",
    ]
    if competition_scope not in valid_competition_scopes:
        raise ValueError(
            f"Invalid competition_scope: {competition_scope}. Must be one of {valid_competition_scopes}"
        )

    try:
        base64.b64decode(logo)
    except Exception as e:
        raise ValueError(f"Invalid logo: {e}")

    if not subdomain or not isinstance(subdomain, str):
        raise ValueError("Invalid subdomain: Must be a non-empty string")

    if default_team and not isinstance(default_team, str):
        raise ValueError("Invalid default_team: Must be a string")

    if default_competition and not isinstance(default_competition, str):
        raise ValueError("Invalid default_competition: Must be a string")

    if default_season and not isinstance(default_season, str):
        raise ValueError("Invalid default_season: Must be a string")


validate_environment_variables()

# Connect to RDS and find the next available ID number
# Identify the correct directory in s3
# Replace the config.json values with default_team, default_competition, default_season
# Replace the club_image.png with the base 64 encoded logo, make this optional too
# Upload the directory to s3
# Call the webhook to kickoff the github actions workflow in the infrastructure repository with the new client details
# That workflow should add the new client to the JSON file, commit and push it to main.
# That workflow should apply the terraform changes.
# That workflow should then output the cognito mappings to the output JSON file and commit this to main too.
# This should then invoke the webhook for the deployment repository which will handle the rest.
# The deployment repository will kick off a workflow to add the client to RDS by git cloning infrastructure and taking the output and other JSON file and running the bootstrap py stuff (should just add a row to the RDS table).
# Important to have is to make sure the cognito user pool name is unique, either by adding a prefix or by retrying.
# Nice to have is to make a request to the website and confirm it's working.
# Nice to have is to possibly use a new bucket in S3 for storing logos instead of using a base64 encoded string and have that as an input.
# Then it would be good to have a lambda and UI in front of this so that we can kick off the github actions workflow remotely. This repository's workflows however don't need to be in github actions really but they are handy.

