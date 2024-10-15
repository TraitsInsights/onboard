import csv
import json
import boto3
import os
import subprocess

# Initialize S3 client
s3_client = boto3.client('s3')

print("Starting the script...")

# Step 1: Read init.json containing a list of tenant configurations
print("Reading init.json...")
with open("init.json", "r", encoding='utf-8') as f:
    try:
        tenants = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}")
        exit(1)

print(f"Total tenants to process: {len(tenants)}")

# Path to clients.csv
clients_file = 'clients.csv'

# Read the existing columns from clients.csv once
if not os.path.exists(clients_file):
    print(f"{clients_file} does not exist. Please ensure the file is present.")
    exit(1)

with open(clients_file, 'r', encoding='utf-8') as file:
    reader = csv.DictReader(file)
    fieldnames = reader.fieldnames
    if fieldnames is None:
        print(f"No columns found in {clients_file}. Please ensure it has a header row.")
        exit(1)

print(f"Clients CSV columns: {fieldnames}")

# Path to cognito_pools.json
cognito_pools_file = '../traits-app/infrastructure/terraform/cognito_pools/cognito_pools.json'

if not os.path.exists(cognito_pools_file):
    print(f"{cognito_pools_file} does not exist. Please ensure the file is present.")
    exit(1)

# Load existing cognito_pools data once
with open(cognito_pools_file, 'r', encoding='utf-8') as file:
    try:
        cognito_pools_data = json.load(file)
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON from {cognito_pools_file}: {e}")
        exit(1)

# Process each tenant
for tenant in tenants:
    print("\n----------------------------------------")
    print(f"Processing tenant ID: {tenant.get('tenant_id', '')}")

    try:
        tenant_id = tenant['tenant_id']
        db_id = tenant['db_id']
        tenant_host = tenant['tenant_host']
        replicate = tenant.get('replicate', False)
        users = tenant.get('users', [])
        details = tenant.get('details', {})

        id_ = tenant.get('tenant_id')
        name = details.get('name')
        provider = details.get('provider')

        if not id_:
            print("Missing 'tenant_id' in tenant details. Skipping this tenant.")
            continue

        print(f"Loaded data: id={id_}, replicate={replicate}")

        # Step 2: Append a row to clients.csv
        print("Appending a row to clients.csv...")
        row_data = details.copy()  # Assuming details has keys matching CSV columns

        with open(clients_file, 'a', newline='', encoding='utf-8') as file:
            writer = csv.DictWriter(file, fieldnames=fieldnames)
            writer.writerow(row_data)
        print(f"Row appended to {clients_file} for tenant ID {id_}.")

        # Step 3: Upload '[id].csv' if exists, else 'default_weights.csv' to S3
        weights_file_local = f"{id_}.csv" if os.path.exists(f"{id_}.csv") else "default_weights.csv"
        weights_file_s3 = f"{id_}.csv"
        print(f"Uploading '{weights_file_local}' as '{weights_file_s3}' to s3://traits-app/settings/weights/...")
        s3_client.upload_file(weights_file_local, 'traits-app', f'settings/weights/{weights_file_s3}')
        print("Weights file upload completed.")

        # Step 4: Copy folder from replicate to id in S3 if replicate is not False
        if replicate:
            print(f"Copying folder from s3://traits-app/deployments/{replicate} to s3://traits-app/deployments/{id_}...")
            source_bucket = 'traits-app'
            source_prefix = f'deployments/{replicate}/'
            destination_prefix = f'deployments/{id_}/'

            # List all objects in the source folder
            paginator = s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=source_bucket, Prefix=source_prefix)

            objects_copied = 0
            for page in pages:
                if 'Contents' in page:
                    for obj in page['Contents']:
                        source_key = obj['Key']
                        destination_key = source_key.replace(source_prefix, destination_prefix, 1)

                        copy_source = {'Bucket': source_bucket, 'Key': source_key}
                        s3_client.copy(copy_source, source_bucket, destination_key)
                        objects_copied += 1
            print(f"Copied {objects_copied} objects from {source_prefix} to {destination_prefix}.")

        # Step 5: Upload '[id].png' as 'club_image.png' to S3
        image_local = f"{id_}.png"
        image_s3 = f'deployments/{id_}/assets/club_image.png'
        print(f"Uploading '{image_local}' as 'club_image.png' to s3://traits-app/{image_s3}...")
        if os.path.exists(image_local):
            s3_client.upload_file(image_local, 'traits-app', image_s3)
            print("Image upload completed.")
        else:
            print(f"Image file '{image_local}' not found. Skipping image upload.")

        # Step 6: Upload '[id]_config.json' if exists, else 'default_config.json' as 'config.json' to S3
        config_file_local = f"{id_}_config.json" if os.path.exists(f"{id_}_config.json") else "default_config.json"
        print(f"Uploading '{config_file_local}' as 'config.json' to s3://traits-app/deployments/{id_}/v2/config.json...")
        s3_client.upload_file(config_file_local, 'traits-app', f'deployments/{id_}/v2/config.json')
        print("Config.json upload completed.")

        # Step 9: Append tenant's user data to cognito_pools.json
        print("Appending tenant's user data to cognito_pools.json...")
        cognito_pools_data.append({
            "name": name,
            "tenant_id": tenant_id,
            "db_id": db_id,
            "tenant_host": tenant_host,
            "users": users
        })

        print("Appended tenant's user data to cognito_pools.json.")

    except KeyError as e:
        print(f"Missing expected key: {e}. Skipping this tenant.")
    except Exception as e:
        print(f"An error occurred while processing tenant ID {id_}: {e}")

# After processing all tenants, write back the updated cognito_pools.json
print("\nWriting updates to cognito_pools.json...")
with open(cognito_pools_file, 'w', encoding='utf-8') as file:
    json.dump(cognito_pools_data, file, indent=4)
print("Updated cognito_pools.json successfully.")

print("\nAll tenants have been processed successfully.")
print("\nMake sure to run the necessary SQL insertions to finalise deployments.")