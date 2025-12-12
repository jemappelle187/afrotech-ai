# Contributing to Afrotech.ai

First off, thank you for considering contributing to Afrotech.ai! 🎉

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues. When creating a bug report, include:

- **Description**: Clear description of the issue
- **Steps to Reproduce**: Detailed steps to reproduce the behavior
- **Expected Behavior**: What you expected to happen
- **Actual Behavior**: What actually happened
- **Screenshots**: If applicable
- **Environment**: Browser, OS, device

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Use Case**: Why would this be useful?
- **Proposed Solution**: How should it work?
- **Alternatives**: Other solutions you've considered
- **Additional Context**: Mockups, examples, etc.

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code, add tests if applicable
3. Ensure the build passes: `npm run build`
4. Make sure your code lints: `npm run lint`
5. Write a clear commit message
6. Open a Pull Request!

## Development Setup

See `SETUP.md` for detailed setup instructions.

Quick start:
```bash
npm install
cp .env.example .env.local
# Edit .env.local with your keys
npm run dev
```

## Code Style

- Use TypeScript
- Follow existing code patterns
- Use Tailwind for styling
- Keep components small and focused
- Comment complex logic

## Project Structure

- `app/` - Next.js pages and API routes
- `components/` - Reusable React components
- `lib/` - Utility functions and configs
- `public/` - Static assets

## Commit Messages

- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit first line to 72 characters
- Reference issues and pull requests

Examples:
```
Add Spotify playlist import feature
Fix beat detection timing issue
Update README with deployment instructions
```

## Areas for Contribution

### High Priority

- [ ] Better 3D models (DJ booth, crowd)
- [ ] Enhanced beat detection algorithm
- [ ] YouTube/SoundCloud integration
- [ ] Mobile optimizations
- [ ] Accessibility improvements

### Features

- [ ] Chat/community features
- [ ] User profiles
- [ ] Playlist creation from recommendations
- [ ] Social sharing
- [ ] Event mode with multiple DJs

### Technical

- [ ] Performance optimizations
- [ ] Better error handling
- [ ] Comprehensive testing
- [ ] Documentation improvements
- [ ] TypeScript strict mode

## Questions?

Feel free to open an issue with your question or reach out to the maintainers.

Thank you for contributing! 🙏




