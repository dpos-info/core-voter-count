# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2022-04-24

### Changed

-   Rename `voterCount` property to `voters`

## [1.1.2] - 2022-04-24

### Added

-   Handle username in vote transactions for solar compatibility

### Fixed

-   Do not throw error if delegate cannot be found

### Changed

-   Remove unneeded delegate registration handler

## [1.1.1] - 2022-04-24

### Fixed

-   Break only after checking the first encountered delegate

## [1.1.0] - 2022-04-24

### Fixed

-   Move listeners to `register` method and break out of voter loop early

## [1.0.0] - 2022-04-23

-   Initial Release
