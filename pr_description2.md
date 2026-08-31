💡 What:
- Enhanced Dashboard.tsx with a new "BarChart" view.
- Added visual customizations like toggling between chart types (Line, Area, Bar).
- Enhanced rendering logic to support multiple visualizations interactively without regressions.

🎯 Why:
Visual appeal and configurability is a crucial part of user experience. Providing different visualizations makes the telemetry data easier to parse in different contexts. A bar chart is especially useful for seeing absolute volumes compared to area/line charts which focus on trends. 100% functional React code with no mockups.

📊 Impact:
- Better user experience with more data visualization options.
- The UI feels significantly more robust and customizable.

🔬 Measurement:
- Click on the settings cog in the System Telemetry panel and toggle the Chart Type to 'Bar' to verify.
