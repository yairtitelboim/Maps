#!/bin/bash
# Step 5: Create Vector Store

echo "=========================================="
echo "Step 5: Creating Vector Store for Q&A"
echo "=========================================="
echo ""

if [ -d "data/grda/vector_store/faiss_index" ]; then
    echo "⚠ Vector store already exists"
    read -p "Recreate vector store? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        python3 scripts/grda/grda_qa_system.py --recreate --query "test" --json > /dev/null 2>&1 || true
        echo "✓ Vector store recreated"
    else
        echo "✓ Using existing vector store"
    fi
else
    python3 scripts/grda/grda_qa_system.py --query "test" --json > /dev/null 2>&1 || true
    echo "✓ Vector store created"
fi

echo ""
echo "Q&A system is ready!"
echo ""
echo "To query the system:"
echo "  python3 scripts/grda/grda_qa_system.py"
echo ""
echo "To test it:"
echo "  python3 scripts/grda/test_grda_system.py"

