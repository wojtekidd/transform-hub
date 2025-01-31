# `@scramjet/utility`

This package is part of [Scramjet Transform Hub](https://www.npmjs.org/package/@scramjet/sth). The package holds utility functions used in places around Scramjet Tranform Hub.

This package includes **domain agnostic** utility **functions**, meaning there shouldn't be any business use-case specific code here. It's important since a package like this one tends to be a very common dependency for other packages. Ideally functions from this package should be written once, well tested and never changed.

## Functions

### Example of a **GOOD** function for this package
This function does not have any knowledge of business components in the system and it's simple. Thus it's pretty stable.
```ts
export const defer = (timeout: number): Promise<void> =>
    new Promise(res => setTimeout(res, timeout));
```

### Example of a **BAD** function for this package
Knowledge about different types of streams on our platform indicates that this function defines a business logic.
```ts
import { EncodedMonitoringMessage, WritableStream } from "@scramjet/types";

export class MessageUtils {
    public static writeMessageOnStream([code, data]: EncodedMonitoringMessage, streamToWrite?: WritableStream<any>){
        if (streamToWrite === undefined) {
            throw new Error("The Stream is not defined.");
        }

        streamToWrite.write(JSON.stringify([code, data]) + "\r\n");
    }
}
```

## Docs

See the code documentation here: [scramjetorg/transform-hub/docs/types/README.md](https://github.com/scramjetorg/transform-hub/tree/HEAD/docs/types/README.md)

## Scramjet Transform Hub

This package is part of [Scramjet Transform Hub](https://www.npmjs.org/package/@scramjet/sth).

Scramjet Transform Hub is a deployment and execution platform. Once installed on a server, it will allow you to start your programs and keep them running on a remote machine. You will be able to start programs in the background or connect to them and see their output directly on your terminal. You will be able to pipe your local data to the program as if it was running from your terminal. You can start your server in AWS, Google Cloud or Azure, start it on your local machine, install it on a Rasperry Pi or wherever else you'd like.

## Some important links

* Scramjet, the company behind [Transform Hub](https://scramjet.org)
* The [Scramjet Framework - functional reactive stream processing framework](https://framework.scramjet.org)
* The [Transform Hub repo onm github](https://github.com/scramjetorg/transform-hub)
* You can see the [Scramjet Transform Hub API docs here](https://github.com/scramjetorg/transform-hub/tree/release/0.10/docs/development-guide/stream-and-api.md)
* You can see the [CLI documentation here](https://github.com/scramjetorg/transform-hub/tree/release/0.10/docs/development-guide/scramjet-interface-cli.md), but `si help` should also be quite effective.
* Don't forget to `star` this repo if you like it, `subscribe` to releases and keep visiting us for new versions and updates.
* You can [open an issue - file a bug report or a feature request here](https://github.com/scramjetorg/transform-hub/issues/new/choose)

## License and contributions

This module is licensed under AGPL-3.0 license.

The Scramjet Transform Hub project is licensed dual licensed under the AGPL-3.0 and MIT licences. Parts of the project that are linked with your programs are MIT licensed, the rest is AGPL.

## Contributions

We accept valid contributions and we will be publishing a more specific project roadmap so contributors can propose features and also help us implement them. We kindly ask you that contributed commits are Signed-Off `git commit --sign-off`.

We provide support for contributors via test cases. If you expect a certain type of workflow to be officially supported, please specify and implement a test case in `Gherkin` format in [`bdd` directory](https://github.com/scramjetorg/transform-hub/tree/HEAD/packages/utility/bdd) and include it in your pull request.

### Help wanted

The project need's your help! There's lots of work to do and we have a lot of plans. If you want to help and be part of the Scramjet team, please reach out to us, [on slack](https://join.slack.com/t/scramjetframework/shared_invite/zt-bb16pluv-XlICrq5Khuhbq5beenP2Fg) or email us: [opensource@scramjet.org](mailto:opensource@scramjet.org).

### Donation

Do you like this project? It helped you to reduce time spent on delivering your solution? You are welcome to buy us a coffee ;)

[You can sponsor us on github](https://github.com/sponsors/scramjetorg)

* There's also a Paypal donation link if you prefer that: [![paypal](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=7F7V65C43EBMW)



