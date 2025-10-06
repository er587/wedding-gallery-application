#!/bin/bash

# Wedding Gallery - Git Repository Verification
# Ensures all custom code is committed before deployment
# Usage: bash deployment/git-verify.sh

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================="
echo "Git Repository Verification"
echo "========================================="
echo ""

# Check if we're in a git repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}ERROR: Not a git repository${NC}"
    exit 1
fi

# Check for uncommitted changes
UNCOMMITTED=$(git status --porcelain)

if [ -z "$UNCOMMITTED" ]; then
    echo -e "${GREEN}✓ All files are committed${NC}"
else
    echo -e "${YELLOW}Warning: Uncommitted changes detected:${NC}"
    echo ""
    git status --short
    echo ""
fi

# Check for untracked Python files in critical directories
echo "Checking for untracked custom modules..."
UNTRACKED_PYTHON=$(git ls-files --others --exclude-standard images/ | grep '\.py$')

if [ -z "$UNTRACKED_PYTHON" ]; then
    echo -e "${GREEN}✓ No untracked Python files in images/${NC}"
else
    echo -e "${RED}✗ Untracked Python files found:${NC}"
    echo "$UNTRACKED_PYTHON"
    echo ""
    echo "Add these files with: git add <filename>"
fi

# Critical files check
echo ""
echo "Verifying critical custom modules are tracked..."

CRITICAL_FILES=(
    "images/storage.py"
    "images/face_recognition_utils.py"
    "images/middleware.py"
    "images/face_views.py"
    "images/thumbnail_processors/__init__.py"
    "images/thumbnail_processors/smart_crop.py"
)

MISSING_FROM_GIT=0

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        if git ls-files --error-unmatch "$file" > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} $file (tracked)"
        else
            echo -e "${RED}✗${NC} $file (NOT TRACKED - run: git add $file)"
            ((MISSING_FROM_GIT++))
        fi
    else
        echo -e "${YELLOW}?${NC} $file (file doesn't exist locally)"
    fi
done

echo ""
echo "========================================="

if [ $MISSING_FROM_GIT -eq 0 ] && [ -z "$UNCOMMITTED" ]; then
    echo -e "${GREEN}✓ Repository ready for deployment${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. git push (if not already pushed)"
    echo "  2. On server: git pull"
    echo "  3. On server: bash deployment/verify-deployment.sh"
    exit 0
else
    echo -e "${YELLOW}⚠ Action required before deployment${NC}"
    echo ""
    
    if [ $MISSING_FROM_GIT -gt 0 ]; then
        echo "Untracked files: Add with 'git add <file>'"
    fi
    
    if [ ! -z "$UNCOMMITTED" ]; then
        echo "Uncommitted changes: Run 'git commit -m \"message\"'"
    fi
    
    echo ""
    echo "After fixing, run: git push"
    exit 1
fi
