function ProfileHarness()
{
    let x = "";
    while (x.length < 10000)
        x = x + "JS";
}

for (let i = 0; i < 1000; i++) {
    ProfileHarness();
}