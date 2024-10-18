import json
import os
import subprocess

print("Starting the script...")

# New Step 10: Run terraform init at ../traits-app/infrastructure/terraform/cognito_pools/
print("Running terraform init...")
subprocess.run(
    ["terraform", "init"], cwd="../traits-app/infrastructure/terraform/cognito_pools/"
)
print("Terraform init completed.")

# New Step 11: Run terraform apply at ../traits-app/infrastructure/terraform/cognito_pools/
print("Running terraform apply...")
subprocess.run(
    ["terraform", "apply"], cwd="../traits-app/infrastructure/terraform/cognito_pools/"
)
print("Terraform apply completed.")

# New Step 12: Run terraform output -raw cognito_pools > cognito_output_mapping.json
print("Running terraform output...")
with open(
    "../traits-app/infrastructure/terraform/cognito_pools/cognito_output_mapping.json",
    "w",
) as outfile:
    subprocess.run(
        ["terraform", "output", "-raw", "cognito_pools"],
        cwd="../traits-app/infrastructure/terraform/cognito_pools/",
        stdout=outfile,
    )
print("Terraform output saved to cognito_output_mapping.json.")

# New Step 13: Run ../traits-app/python bootstrapper.py
print("Running bootstrapper.py...")

# Get init json and map each details.name field to a list
with open("./init.json", "r") as file:
    data = json.load(file)

tenants_to_create = [item["details"]["name"] for item in data]

os.environ["TENANTS_TO_CREATE"] = ",".join(tenants_to_create)
subprocess.run(
    ["python", "bootstrapper.py"],
    cwd="../traits-app/",
)
print("Bootstrapper.py completed.")

print("Script completed.")
