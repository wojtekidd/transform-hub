Feature: Kill e2e tests

    @ci
    Scenario: E2E-003 TC-001 API test - Kill instance
        Given host is running
        When sequence "../packages/reference-apps/hello-alice-out.tar.gz" loaded
        And instance started with arguments "/package/data.json"
        And wait for instance healthy is "true"
        And get containerId
        And send kill message to instance
        And container is closed
        Then host is still running

    # This is a potential edge case so it's currently ignored.
    @ignore
    Scenario: E2E-003 TC-002 Kill sequence - kill handler should emit event when executed
        Given host is running
        When sequence "../packages/reference-apps/sequence-20s-kill-handler.tar.gz" loaded
        And instance started with arguments "/package/data.json"
        And wait for instance healthy is "true"
        And get containerId
        Then get event "kill-handler-called" from instance
        When send kill message to instance
        Then instance response body is "{\"eventName\":\"kill-handler-called\",\"message\":\"\"}"
        And container is closed
        Then host is still running
