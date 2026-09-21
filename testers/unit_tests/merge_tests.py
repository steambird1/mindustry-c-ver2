import os

final_content = []
dones = []

def traverse(curr):
    global final_content, dones
    print(f"Visiting directory: {curr}")
    for dirpath, dirnames, filenames in os.walk(curr):
        for i in dirnames:
            traverse(os.path.join(dirpath, i))
        print(f"Files of {curr}: {filenames}")
        for simp_filename in filenames:
            filename = os.path.join(dirpath, simp_filename)
            aus_filename = filename[filename.find("unit_tests"):]
            #print(f"Handling {filename}")
            final_content.append(f"/* BEGIN: {aus_filename} */\n")
            with open(filename, "r") as f:
                final_content += f
            final_content.append(f"/* END: {aus_filename} */\n")
            dones.append(aus_filename)


traverse(os.getcwd())
print(len(dones),len(set(dones)))
#with open("result.txt", "w") as fr:
#    for i in final_content:
#        fr.write(i)