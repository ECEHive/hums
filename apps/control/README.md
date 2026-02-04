# Control Kiosk App

A kiosk application for controlling equipment control points via card authentication.

## Features

- **Card-based Authentication**: Users tap their card to authenticate
- **Control Point Display**: Shows all available control points with their current status
- **Permission-based Access**: Only shows control points the user is authorized to operate
- **Real-time Status**: Status of control points is refreshed periodically
- **Equipment Control**: Allows users to operate equipment they have access to

## Development

```bash
# Install dependencies
bun install

# Run development server
bun run dev
```

## Configuration

The control kiosk requires:

1. A device registered with `hasControlAccess: true`
2. Control points assigned to the device
3. Users with appropriate control point permissions

## How It Works

1. **Idle State**: The kiosk displays a "Tap Your Card" prompt
2. **Authentication**: When a card is tapped, the system checks user permissions
3. **Selection**: Authenticated users see their authorized control points
4. **Operation**: Select a control point and tap card again to confirm operation
5. **Feedback**: Success/error feedback is displayed

## Architecture

- Built with React 19 and Vite
- Uses TanStack Query for data fetching
- Styled with Tailwind CSS
- Animations powered by Motion

## Related Configuration

Session types can be enabled/disabled for kiosks via the configuration settings:
- `kiosk.sessions.regular.enabled`: Allow regular sessions on kiosks
- `kiosk.sessions.staffing.enabled`: Allow staffing sessions on kiosks
