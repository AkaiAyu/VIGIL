from ai.manager import AIManager


def main():
    manager = AIManager()

    conversation = """
    Caller says they are from the victim's bank.
    They claim there was suspicious activity on the account.
    They tell the victim that the account will be blocked
    unless the victim provides the OTP received on their phone.
    """

    result = manager.analyze_conversation(conversation)

    print("\nCALLSHIELD TEST RESULT")
    print("======================")

    for key, value in result.items():
        print(f"{key}: {value}")


if __name__ == "__main__":
    main()