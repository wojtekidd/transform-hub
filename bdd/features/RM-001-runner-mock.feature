Feature: Mock runner tests.

    @ignore
    Scenario: RM-001 TC-001 After sending ping, mock runner replies with pong.
        Given mock runner is running
        When a message "PING" is sent
        Then a message "PONG" is received

    @ignore
    Scenario: RM-001 TC-002 Mock runner confirms receiving correct request.
        Given mock runner is running
        When a message "ALIVE" is sent
        Then a message "ALIVE_RESPONSE" is received

    @ignore
    Scenario: RM-001 TC-003 Mock runner recognizes incorrect messages.
        Given mock runner is running
        When a message "INCORRECT" is sent
        Then a message "INCORRECT_MESSAGE_RESPONSE" is received

    @ignore
    Scenario: RM-001 TC-004 Mock runner stops running after sending kill message.
        Given mock runner is running
        When a message "KILL" is sent
        Then mock runner is not running

    @ignore
    Scenario: RM-001 TC-005 Monitoring message is received when runner is running in monitoring mode.
        Given mock runner is running with monitoring
        Then a message "HEALTHY" is received
