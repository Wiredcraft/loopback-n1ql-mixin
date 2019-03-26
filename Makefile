ENV = NODE_ENV=test DEBUG=loopback:n1ql:*
MOCHA = ./node_modules/.bin/_mocha
MOCHA_OPTS = -b --timeout 100000 --reporter spec --exit
TESTS = test/*.test.js
ISTANBUL = ./node_modules/.bin/istanbul
COVERALLS = ./node_modules/.bin/coveralls

install:
	@echo "Installing..."
	@npm install
	@npm prune
lint:
	@echo "Linting..."
	@./node_modules/.bin/jscs index.js lib test
test: lint
	@echo "Testing..."
	@$(ENV) $(MOCHA) $(MOCHA_OPTS) $(TESTS)
test-cov: lint
	@echo "Testing..."
	@$(ENV) $(ISTANBUL) cover $(MOCHA) -- $(MOCHA_OPTS) $(TESTS)
send-coveralls:
	@cat ./coverage/lcov.info | $(COVERALLS) --verbose
test-coveralls: test-cov send-coveralls
.PHONY: install lint test test-cov send-coveralls test-coveralls