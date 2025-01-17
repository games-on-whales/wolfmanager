# wolfmanager
A web interface for managing Wolf, providing a centralized dashboard for game library management and Wolf configuration.

Current Features:
- Steam game library integration
- Game artwork fetching from SteamGridDB
- User management interface
- Admin settings configuration
- Task management and monitoring
- System log viewing
- Wolf API integration
- Configuration management

Here are some screenshots of the current state of the project
![screenshot](./images/dashboard.png)

# TODO

## Game Management
- [ ] Add method for installing games using SteamCMD or scanning existing install library
- [ ] Add installed game into Wolf Configured apps along with game artwork and direct launch for steam
- [ ] Implement manual artwork search for games with missing artwork

## Wolf Management
- [x] Expose wolf API to frontend
- [ ] Implement full session management
- [ ] Enhance client pairing workflow

## Security
- [ ] Implement authentication system
- [ ] Add role-based access control
- [ ] Enhance user state isolation

## Other
- [ ] Publish Bruno API collection for diagnostics and development
- [ ] Add comprehensive error handling
- [ ] Implement automated testing

# Wishful Thinking
- [ ] Have Wolf Manager detect and create the wolf stack it manages
- [ ] Implement additional game libraries
- [ ] Add support for non-Steam game libraries
- [ ] Implement backup and restore functionality

# Known Issues
- Some artwork does not display for games, need a method for manually searching
- Authentication system needs to be implemented
- Some API endpoints need additional error handling

# FAQ
- Q: How does this help with shared libraries?
- A: Long term what we want to do is have it create an app entry for each game using the steam container we have and mount the specific game files into the container as a read only layer with the writable layer pointing back to the user profile path. The user experience would be launch moonlight and then select the game, it launches and game state data is saved in the profile path. Game updates are then handled by WolfManager using SteamCMD.

- Q: How does multi-user work?
- A: Wolf doesn't have the concept of users, just devices and where the state for each device is stored. Wolf does allow one state folder to work across multiple devices, so what we can do is have WolfManager create a user state folder for each user and then point all devices for that user to the same state folder. We can manage users and their pairing through Wolf Manager. But this is all future work and could change.

# Tools and Technology
Wolf Manager is built with React and TypeScript, featuring a modern component-based architecture. The project uses Vite for building and development. Development is assisted by Cursor AI for implementation while focusing on design, research, and problem-solving.  
