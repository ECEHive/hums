# CSV Import Testing

## Sample CSV File

Create a file named `sample_items.csv` with the following content:

```csv
name,description,sku,location,minQuantity,initialQuantity,isActive
Arduino Uno,Microcontroller board based on ATmega328P,ARDUINO-UNO,Shelf A1,5,20,true
Raspberry Pi 4,Single-board computer with 4GB RAM,RPI4-4GB,Shelf A2,3,15,true
Breadboard,830-point solderless breadboard,,Shelf B1,10,50,true
Resistor Pack,100-pack of 220Ω resistors,,Shelf C1,5,200,yes
LED Pack,50-pack of red 5mm LEDs,,Shelf C2,10,100,1
Jumper Wires,40-pack of male-to-male jumper wires,,Shelf B2,8,75,y
Multimeter,Digital multimeter with auto-ranging,DMM-001,Equipment Room,2,5,true
Soldering Iron,Temperature-controlled soldering station,SOLD-60W,Workbench 1,1,3,true
Old Component,Deprecated component for testing,OLD-001,Storage,0,0,false
```

## Column Descriptions

- **name** (required): The name of the item
- **description** (optional): A detailed description of the item
- **sku** (optional): Stock Keeping Unit - if not provided, will be auto-generated (8-character alphanumeric)
- **location** (optional): Physical location of the item
- **minQuantity** (optional): Minimum quantity threshold for low stock alerts
- **initialQuantity** (optional): Starting inventory count - creates a snapshot
- **isActive** (optional): Whether the item is active (true/false, 1/0, yes/no, y/n) - defaults to true

## Testing Different Scenarios

### Test 1: Minimal CSV (name only)
```csv
name
Basic Item 1
Basic Item 2
Basic Item 3
```

### Test 2: Mixed Case Headers
```csv
NAME,Description,SKU,LOCATION
Test Item,This is a test,TEST-001,Lab
Another Item,Another test,,Shelf A
```

### Test 3: Boolean Variations
```csv
name,isActive
Active Item 1,true
Active Item 2,1
Active Item 3,yes
Active Item 4,y
Inactive Item 1,false
Inactive Item 2,0
Inactive Item 3,no
Inactive Item 4,n
```

### Test 4: With Initial Quantities
```csv
name,minQuantity,initialQuantity
Capacitor 100nF,50,500
Capacitor 10uF,30,300
Transistor 2N2222,25,200
```

## Expected Behavior

1. **Auto-generated SKUs**: Items without SKUs will get random 8-character codes like "A7K3M9P2"
2. **Case-insensitive headers**: "name", "NAME", "Name" all work
3. **Duplicate SKU handling**: If a SKU already exists in the database or appears twice in the CSV, that row will fail
4. **Validation errors**: Will be reported with row numbers
5. **Partial success**: If some rows fail validation, successful rows will still be imported
6. **Snapshots**: Items with initialQuantity will have an inventory snapshot created

## Import Process

1. Click "Import CSV" button on the Items page
2. Review the format requirements in the dialog
3. Drag and drop your CSV file or click to browse
4. Click "Import Items" to process the file
5. Review success/failure messages

## Common Issues

- **Missing header row**: CSV must have a header row with column names
- **Empty name column**: Every row must have a name
- **Invalid numbers**: minQuantity and initialQuantity must be non-negative integers
- **Invalid boolean**: isActive must be true/false, 1/0, yes/no, or y/n
- **Duplicate SKUs**: SKUs must be unique within the CSV and in the database
