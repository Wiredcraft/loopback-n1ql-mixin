ENV = NODE_ENV=test DEBUG=loopback:n1ql:*
MOCHA = ./node_modules/.bin/_mocha
BIN = ./node_modules/.bin
MOCHA_OPTS = -b --timeout 10000 --reporter spec --exit
TESTS = test/*.test.js

install:
	@echo "Installing..."
	@npm install
	@npm prune
lint:
	@echo "Linting JavaScript..."
	@$(BIN)/eslint --fix .
test: lint
	@echo "Testing..."
	@$(ENV) $(MOCHA) $(MOCHA_OPTS) $(TESTS)
test-cov: lint
	@echo "Testing..."
	@NODE_ENV=test $(DEBUG) $(BIN)/nyc $(BIN)/_mocha $(MOCHA_OPTS) $(TESTS) && $(BIN)/nyc report --reporter=text-lcov > coverage.lcov
test-coveralls: test-cov
	@cat coverage.lcov | $(BIN)/coveralls --verbose
.PHONY: lint test test-cov test-coveralls