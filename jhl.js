document.addEventListener("DOMContentLoaded", () => {
        let uploadingStarted = false;

        const fileInput = document.getElementById("file-input");
        const uploadButton = document.getElementById("upload-button");
        const submitButton = document.getElementById("upload-button");

        const uploadBgImg = document.querySelector(".upload-file-bg-img");
        const progressBarContainer = document.querySelector(".progress-bar-container");
        const progressFill = document.querySelector(".progress-fill");
        const pleaseWaitElement = document.querySelector(".please-wait");

        function handleDragOver(event) {
            event.preventDefault();
            fileDropZone.classList.add("drag-over");
        }

        function handleFileDrop(event) {
            if (uploadingStarted == false) {
                event.preventDefault();
                fileDropZone.classList.remove("drag-over");

                const files = event.dataTransfer.files;
                if (files.length > 0) {
                    fileInput.files = files;
                    //uploadButton.style.display = "block";
                    submitFileForm()
                }
            }
        }

        const fileDropZone = document.getElementById("file-drop-zone");
        const openFileExplorerElement = document.querySelector(".open-file-explorer-paragraph");

        openFileExplorerElement.addEventListener("click", () => { if (uploadingStarted == false) { fileInput.click() } });

        fileDropZone.addEventListener("dragover", () => {
            event.preventDefault();
            fileDropZone.classList.add("drag-over");
        });

        //DROPF
        let formDataArray = {}; // Create a new FormData object
        let singleFilesFormData = new FormData();

        let hasSingleFiles = false;
        let hasDirectories = false;

        function traverseFileTree(item, filesSize, path = '') {
            return new Promise((resolve) => {
                if (item.isFile) {
                    item.file((file) => {

                        if (path) {
                            let key = path.split('/')[0];

                            if (!formDataArray[key]) {
                                formDataArray[key] = new FormData();
                            }

                            formDataArray[key].append('rootFileName', key);

                            //console.log("File:", path + file.name);
                            filesSize.total += file.size;

                            //console.log(`FILE SIZE: ${file.size}`);
                            formDataArray[key].append('files', file);

                            //console.log(`FILE PATH ${path} IS DIRECTORY ${path ? true : false}`);
                            hasDirectories = true;

                            formDataArray[key].append('originalPaths', path);
                        } else {
                            //console.log("File:", path + file.name);
                            filesSize.total += file.size;

                            //console.log(`FILE SIZE: ${file.size}`);
                            singleFilesFormData.append('files', file);

                            //console.log(`FILE PATH ${path} IS DIRECTORY ${path ? true : false}`);
                            hasSingleFiles = true;

                            singleFilesFormData.append('originalPaths', path);
                        }

                        resolve();
                    });
                } else if (item.isDirectory) {
                    const dirReader = item.createReader();
                    dirReader.readEntries((entries) => {
                        const promises = entries.map(entry => traverseFileTree(entry, filesSize, path + item.name + "/"));
                        Promise.all(promises).then(() => resolve());
                    });
                } else {
                    resolve();
                }
            });
        }

        fileDropZone.addEventListener('drop', (e) => {
            console.log("h");
            e.preventDefault();
            const items = e.dataTransfer.items;
            let filesSize = { total: 0 };

            let rootFileName = null;

            if (e.dataTransfer.files.length == 1) {
                rootFileName = e.dataTransfer.files[0].name;
            }

            //console.log(rootFileName);

            const promises = [];
            for (let i = 0; i < items.length; i++) {
                const item = items[i].webkitGetAsEntry();
                if (item) {
                    //console.log(`ITEM: ${item}`);
                    promises.push(traverseFileTree(item, filesSize));
                }
            }

            Promise.all(promises).then(() => {
                //console.log(`TOTAL FILE SIZE: ${filesSize.total}`);
                // At this point, you can continue with the rest of your code
                // knowing that all files have been traversed successfully
                if (hasSingleFiles != hasDirectories) {
                    StartFilesUpload(filesSize.total, rootFileName);
                } else {
                    hasSingleFiles = false;
                    hasDirectories = false;
                    formDataArray = {};
                    singleFilesFormData = new FormData();

                    toastr.error("Please upload either separate files or folders only.");
                }
            });
        });

        function StartFilesUpload(totalSize, rootFileName) {
            uploadBgImg.style.display = "none";
            let fillPercentage = { value: 0 }
            let fileSizeMb = totalSize / 1000000;
            let speed = (fileSizeMb / 100) * 1000;

            let fillInterval = setInterval(() => fillProgressBar(fillPercentage), speed);

            progressBarContainer.style.display = "flex";

            if (hasSingleFiles == true) {
                singleFilesFormData.append('rootFileName', rootFileName);

                // Using Fetch API to submit the form data
                fetch('/Home/UploadFile', {
                    method: 'POST',
                    body: singleFilesFormData // Send the formData object
                })
                    .then(response => response.json())
                    .then(data => {
                        clearInterval(fillInterval);
                        //console.log(data)
                        location.reload();
                        //progressBarContainer.style.display = "none";
                    })
                    .catch((error) => {
                        clearInterval(fillInterval);
                        console.error('Error:', error)
                    });
            } else if (hasDirectories == true) {
                let totalCount = Object.values(formDataArray).length;
                let currentCount = 0;

                Object.values(formDataArray).forEach(formData => {
                    // Using Fetch API to submit the form data
                    fetch('/Home/UploadFile', {
                        method: 'POST',
                        body: formData // Send the formData object
                    })
                        .then(response => response.json())
                        .then(data => {
                            currentCount++;

                            if (pleaseWaitElement.textContent != "Please wait") {
                                pleaseWaitElement.textContent = `${currentCount}/${totalCount}`;
                            }
                            console.log(`PROGRESS ${currentCount}/${totalCount}`);

                            if (currentCount == totalCount) {
                                clearInterval(fillInterval);
                                //console.log(data);
                                location.reload();
                                //progressBarContainer.style.display = "none";
                            }
                        })
                        .catch((error) => {
                            clearInterval(fillInterval);
                            console.error('Error:', error)
                        });
                })
            }
        }

        function fillProgressBar(fillPercentage) {
            //console.log("called");
            if (fillPercentage.value < 100) {
                progressFill.style.width = `${fillPercentage.value}%`;
            } else {
                pleaseWaitElement.style.display = "block";
                pleaseWaitElement.textContent = "Please wait";
            }
            fillPercentage.value++;
        }

        fileInput.addEventListener("change", () => {
            let totalSize = 0;
            let rootFileName = null;

            if (fileInput.files.length === 1) {
                rootFileName = fileInput.files[0].name;
            }

            for (const file of fileInput.files) {
                hasSingleFiles = true;
                totalSize += file.size;
                singleFilesFormData.append('files', file);
                singleFilesFormData.append('originalPaths', "/");
            }

            singleFilesFormData.append('rootFileName', rootFileName);

            StartFilesUpload(totalSize, rootFileName); // Call your upload function with the formData
        });
    })
