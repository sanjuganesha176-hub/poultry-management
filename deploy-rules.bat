@echo off
echo Deploying Firestore and Storage rules to Firebase...
echo.

REM Check if Firebase CLI is installed
where firebase >nul 2>&1
if %errorlevel% neq 0 (
    echo Firebase CLI not found. Installing...
    npm install -g firebase-tools
)

echo.
echo Logging into Firebase...
call firebase login

echo.
echo Deploying Firestore rules...
call firebase deploy --only firestore:rules --project poutry-management

echo.
echo Deploying Storage rules...
call firebase deploy --only storage --project poutry-management

echo.
echo Done!
pause
